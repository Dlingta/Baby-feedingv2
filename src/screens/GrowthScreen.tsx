import React, { useEffect, useMemo, useState } from 'react';
import { GrowthRecord, PlanetAppState } from '../types/planet';
import { getTodayDateStr } from '../data/initialData';
import {
  GrowthMeasurement,
  GrowthMetricKey,
  GrowthViewRoute,
} from '../modules/growth/types/growth';
import {
  getReferenceLoadMode,
  ReferenceLoadMode,
  setReferenceLoadMode,
} from '../modules/growth/data/whoGrowthStandards';
import {
  buildGrowthReminders,
  growthStorageService,
  mapMeasurementToPlanetRecord,
  mapPlanetProfileToGrowthProfile,
  mapPlanetRecordsToMeasurements,
} from '../modules/growth/services/growthStorage';
import { GrowthOverview } from '../modules/growth/pages/GrowthOverview';
import { GrowthAssessment } from '../modules/growth/pages/GrowthAssessment';
import { GrowthEntry } from '../modules/growth/pages/GrowthEntry';

export type GrowthViewMode = GrowthViewRoute;

interface GrowthScreenProps {
  state: PlanetAppState;
  mode: GrowthViewMode;
  onChangeMode: (mode: GrowthViewMode) => void;
  onBackHome: () => void;
  onOpenSettings: () => void;
  onSaveGrowth: (record: GrowthRecord) => void;
  onDeleteGrowth: (id: string) => void;
}

export const GrowthScreen: React.FC<GrowthScreenProps> = ({
  state,
  mode,
  onChangeMode,
  onBackHome,
  onOpenSettings,
  onSaveGrowth,
  onDeleteGrowth,
}) => {
  const todayStr = getTodayDateStr();
  const [activeMetric, setActiveMetric] = useState<GrowthMetricKey>('heightCm');
  const [editingMeasurement, setEditingMeasurement] = useState<GrowthMeasurement | null>(null);
  const [referenceMode, setReferenceMode] = useState<ReferenceLoadMode>(() =>
    getReferenceLoadMode()
  );

  const growthProfile = useMemo(
    () => mapPlanetProfileToGrowthProfile(state.profile),
    [state.profile]
  );

  const measurements = useMemo(
    () => mapPlanetRecordsToMeasurements(state.growths, growthProfile.babyId),
    [state.growths, growthProfile.babyId]
  );

  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(
    measurements[measurements.length - 1]?.id || null
  );

  // 确保选中 ID 始终有效（例如删除当前选中记录时回退到最新记录）
  useEffect(() => {
    if (measurements.length === 0) {
      setSelectedMeasurementId(null);
      return;
    }
    if (!selectedMeasurementId || !measurements.some((m) => m.id === selectedMeasurementId)) {
      setSelectedMeasurementId(measurements[measurements.length - 1].id);
    }
  }, [measurements, selectedMeasurementId]);

  // 轻量 Hash 路由同步（支持 #/growth/overview、#/growth/assessment、#/growth/entry）
  useEffect(() => {
    const targetHash = `#/growth/${mode}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [mode]);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash;
      if (h === '#/growth/overview') onChangeMode('overview');
      else if (h === '#/growth/assessment') onChangeMode('assessment');
      else if (h === '#/growth/entry') onChangeMode('entry');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [onChangeMode]);

  // 实时计算并持久化所有记录的 WHO 营养评价快照（附带参考版本追溯）
  const assessments = useMemo(
    () =>
      growthStorageService.recomputeAndPersistAssessments(
        growthProfile,
        measurements,
        referenceMode
      ),
    [growthProfile, measurements, referenceMode]
  );

  const reminders = useMemo(
    () => buildGrowthReminders(growthProfile, measurements, todayStr),
    [growthProfile, measurements, todayStr]
  );

  const handleToggleReferenceMode = (nextMode: ReferenceLoadMode) => {
    setReferenceLoadMode(nextMode);
    setReferenceMode(nextMode);
  };

  const handleGoToCreate = () => {
    setEditingMeasurement(null);
    onChangeMode('entry');
  };

  const handleGoToEdit = (measurement: GrowthMeasurement) => {
    setEditingMeasurement(measurement);
    onChangeMode('entry');
  };

  const handleSaveForm = (measurement: GrowthMeasurement) => {
    onSaveGrowth(mapMeasurementToPlanetRecord(measurement));
    setSelectedMeasurementId(measurement.id);
    setEditingMeasurement(null);
    onChangeMode('overview');
  };

  const handleGoToAssessment = (measurementId?: string) => {
    if (measurementId) {
      setSelectedMeasurementId(measurementId);
    }
    onChangeMode('assessment');
  };

  if (mode === 'entry') {
    return (
      <GrowthEntry
        profile={growthProfile}
        todayStr={todayStr}
        editingMeasurement={editingMeasurement}
        onSave={handleSaveForm}
        onCancel={() => {
          setEditingMeasurement(null);
          onChangeMode('overview');
        }}
      />
    );
  }

  if (mode === 'assessment') {
    return (
      <GrowthAssessment
        profile={growthProfile}
        measurements={measurements}
        assessments={assessments}
        reminders={reminders}
        selectedMeasurementId={selectedMeasurementId}
        referenceMode={referenceMode}
        onSelectMeasurement={setSelectedMeasurementId}
        onBackOverview={() => onChangeMode('overview')}
        onGoToCreate={handleGoToCreate}
        onOpenSettings={onOpenSettings}
        onToggleReferenceMode={handleToggleReferenceMode}
      />
    );
  }

  return (
    <GrowthOverview
      profile={growthProfile}
      measurements={measurements}
      assessments={assessments}
      reminders={reminders}
      todayStr={todayStr}
      activeMetric={activeMetric}
      selectedMeasurementId={selectedMeasurementId}
      referenceMode={referenceMode}
      onChangeMetric={setActiveMetric}
      onSelectMeasurement={setSelectedMeasurementId}
      onGoToAssessment={handleGoToAssessment}
      onGoToCreate={handleGoToCreate}
      onGoToEdit={handleGoToEdit}
      onDeleteMeasurement={onDeleteGrowth}
      onOpenSettings={onOpenSettings}
      onBackHome={onBackHome}
      onRetryLoadReference={() => handleToggleReferenceMode('official_who_2006')}
    />
  );
};
