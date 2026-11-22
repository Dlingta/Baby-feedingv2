import React from 'react';
import { FolderOpen, Layers, RotateCcw, Smartphone, Tag } from 'lucide-react';
import { ScreenCode } from '../types/planet';

export type PreviewWidthPreset = 375 | 390 | 430;

interface PrototypeSidebarProps {
  activeScreen: ScreenCode;
  showSlotTag: boolean;
  previewWidth: PreviewWidthPreset;
  onSelectPreviewWidth: (width: PreviewWidthPreset) => void;
  onSelectScreen: (code: ScreenCode) => void;
  onToggleSlotTag: () => void;
  onResetDemo: () => void;
}

const WIDTH_PRESETS: { width: PreviewWidthPreset; ratioLabel: string }[] = [
  { width: 375, ratioLabel: '375×667' },
  { width: 390, ratioLabel: '390×694' },
  { width: 430, ratioLabel: '430×764' },
];

const SCREEN_GROUPS: {
  title: string;
  items: { code: ScreenCode; label: string }[];
}[] = [
  {
    title: '1. 我的星球 (Home)',
    items: [
      { code: '1.1', label: '1.1 首页 · 完整状态' },
      { code: '1.2', label: '1.2 首页 · 未初始化空状态' },
    ],
  },
  {
    title: '2. 星光碎片 (Diary)',
    items: [
      { code: '2.1', label: '2.1 日记 · 列表与详情' },
      { code: '2.2', label: '2.2 日记 · 荒野空状态' },
      { code: '2.3', label: '2.3 日记 · 新建/编辑表单' },
    ],
  },
  {
    title: '3. 能量补给 (Feeding)',
    items: [
      { code: '3.1', label: '3.1 喂养 · 双轴图与时间线' },
      { code: '3.2', label: '3.2 喂养 · 空玻璃奶瓶状态' },
      { code: '3.3', label: '3.3 喂养 · OCR 与三段式表单' },
    ],
  },
  {
    title: '4. 观测坐标 (Growth)',
    items: [
      { code: '4.1', label: '4.1 成长 · 走势与历史' },
      { code: '4.2', label: '4.2 成长 · 专业营养评价' },
      { code: '4.3', label: '4.3 成长 · 新建成长记录' },
    ],
  },
  {
    title: '5. 治愈工坊 (Health)',
    items: [
      { code: '5.1', label: '5.1 健康 · 19剂疫苗护盾' },
      { code: '5.2', label: '5.2 健康 · 疫苗打卡弹窗' },
      { code: '5.3', label: '5.3 健康 · 生病与病历记录' },
      { code: '5.4', label: '5.4 健康 · 新建生病与病历' },
    ],
  },
  {
    title: '6. 星球档案与数据舱 (Settings)',
    items: [{ code: '6.1', label: '6.1 档案设置与记忆备份' }],
  },
];

export const PrototypeSidebar: React.FC<PrototypeSidebarProps> = ({
  activeScreen,
  showSlotTag,
  previewWidth,
  onSelectPreviewWidth,
  onSelectScreen,
  onToggleSlotTag,
  onResetDemo,
}) => {
  return (
    <aside className="hidden lg:flex w-[360px] shrink-0 flex-col border-r border-white/10 bg-[#070f25] p-5 text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Smartphone className="h-4 w-4" />
            <span>原型页面索引（16 个核心视图）</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            右侧为 9:16 可交互移动端画布，支持 375/390/430px 宽度预览
          </p>
        </div>
      </div>

      {/* 9:16 屏幕宽度切换 */}
      <div className="mt-3.5 rounded-[20px] border border-white/10 bg-white/[0.04] p-2.5">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-indigo-200/80">
          <span>9:16 屏幕尺寸预览</span>
          <span className="font-typewriter text-amber-200">{previewWidth}px</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {WIDTH_PRESETS.map((preset) => {
            const active = previewWidth === preset.width;
            return (
              <button
                key={preset.width}
                type="button"
                onClick={() => onSelectPreviewWidth(preset.width)}
                className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-center transition-colors ${
                  active
                    ? 'bg-amber-300 text-slate-900 font-bold shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="text-xs leading-tight">{preset.width}px</span>
                <span
                  className={`mt-0.5 text-[9.5px] font-typewriter ${
                    active ? 'text-slate-800/80' : 'text-slate-400'
                  }`}
                >
                  {preset.ratioLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 工具开关 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleSlotTag}
          className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            showSlotTag
              ? 'border-amber-400 bg-amber-300/15 text-amber-200'
              : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Tag className="h-3.5 w-3.5" />
          <span>{showSlotTag ? '隐藏槽位标注' : '显示素材槽位'}</span>
        </button>

        <button
          type="button"
          onClick={onResetDemo}
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-300 hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>重置演示数据</span>
        </button>
      </div>

      {/* 15 张页面状态索引 */}
      <div className="mt-4 space-y-4">
        {SCREEN_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-indigo-200/80">
              <Layers className="h-3.5 w-3.5 text-amber-300/80" />
              <span>{group.title}</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {group.items.map((item) => {
                const active = activeScreen === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => onSelectScreen(item.code)}
                    className={`flex min-h-[36px] items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? 'bg-amber-300 text-slate-900 font-bold shadow-sm'
                        : 'bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {active && <span className="shrink-0 text-[10px]">当前</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 字体与素材预留文件夹说明 */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-200">
          <FolderOpen className="h-4 w-4" />
          <span>预留字体与素材目录</span>
        </div>
        <div className="space-y-1 font-mono text-[11px] text-slate-300/90">
          <div>/public/fonts/ — 自定义字体目录</div>
          <div>/public/assets/custom/ — 按钮与插画目录</div>
          <div>/public/assets/aistudio/ — 已上传原图</div>
        </div>
      </div>
    </aside>
  );
};
