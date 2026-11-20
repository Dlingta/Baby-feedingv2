import { PlanetAppState, VaccineDose } from '../types/planet';

export function formatLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateStr(now: Date = new Date()): string {
  return formatLocalDateStr(now);
}

export function getCurrentTimeStr(now: Date = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return getTodayDateStr();
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDateStr(d);
}

export function createVaccineSchedule19(todayStr: string = getTodayDateStr()): VaccineDose[] {
  const birthDate = shiftDateStr(todayStr, -41);
  const oneMonthDate = shiftDateStr(todayStr, -10);

  return [
    {
      id: 'vac-1',
      order: 1,
      name: '乙肝疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '出生时',
      description: '登陆地球第一份防护护盾',
      status: 'activated',
      inoculatedDate: birthDate,
      brandOrigin: '国产',
      fundingType: '免费',
      note: '产房内顺利激活，无异常哭闹',
    },
    {
      id: 'vac-2',
      order: 2,
      name: '卡介苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '出生时',
      description: '左上臂专属星印护盾',
      status: 'activated',
      inoculatedDate: birthDate,
      brandOrigin: '国产',
      fundingType: '免费',
      note: '左臂轻微红晕，属正常反应',
    },
    {
      id: 'vac-3',
      order: 3,
      name: '乙肝疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '1 月龄',
      description: '巩固肝脏防御力场',
      status: 'activated',
      inoculatedDate: oneMonthDate,
      brandOrigin: '国产',
      fundingType: '免费',
      note: '接种后多喝温水，睡眠香甜',
    },
    {
      id: 'vac-4',
      order: 4,
      name: '脊灰灭活疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '2 月龄',
      description: '守护小漫游者骨骼与神经通路',
      status: 'next',
    },
    {
      id: 'vac-5',
      order: 5,
      name: '脊灰灭活疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '3 月龄',
      description: '二次加固运动神经护盾',
      status: 'locked',
    },
    {
      id: 'vac-6',
      order: 6,
      name: '百白破疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '3 月龄',
      description: '百日咳、白喉、破伤风三联防护',
      status: 'locked',
    },
    {
      id: 'vac-7',
      order: 7,
      name: '脊灰减毒疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '4 月龄',
      description: '口服糖丸或滴剂强化免疫',
      status: 'locked',
    },
    {
      id: 'vac-8',
      order: 8,
      name: '百白破疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '4 月龄',
      description: '三联防护持续充能',
      status: 'locked',
    },
    {
      id: 'vac-9',
      order: 9,
      name: '百白破疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '5 月龄',
      description: '完成基础三联护盾构建',
      status: 'locked',
    },
    {
      id: 'vac-10',
      order: 10,
      name: '乙肝疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '6 月龄',
      description: '乙肝防御矩阵满格锁定',
      status: 'locked',
    },
    {
      id: 'vac-11',
      order: 11,
      name: 'A群流脑多糖疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '6 月龄',
      description: '脑膜炎球菌初始防御层',
      status: 'locked',
    },
    {
      id: 'vac-12',
      order: 12,
      name: '麻腮风疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '8 月龄',
      description: '抵御麻疹、腮腺炎与风疹',
      status: 'locked',
    },
    {
      id: 'vac-13',
      order: 13,
      name: '乙脑减毒活疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '8 月龄',
      description: '夏季蚊虫季神经防护',
      status: 'locked',
    },
    {
      id: 'vac-14',
      order: 14,
      name: 'A群流脑多糖疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '9 月龄',
      description: '流脑护盾强化升级',
      status: 'locked',
    },
    {
      id: 'vac-15',
      order: 15,
      name: '甲肝减毒活疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '18 月龄',
      description: '探索辅食世界的肠道卫士',
      status: 'locked',
    },
    {
      id: 'vac-16',
      order: 16,
      name: '百白破疫苗',
      doseLabel: '第 4 剂',
      recommendedMonth: '18 月龄',
      description: '一岁半加强型三联护盾',
      status: 'locked',
    },
    {
      id: 'vac-17',
      order: 17,
      name: '麻腮风疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '18 月龄',
      description: '麻腮风长效记忆锁存',
      status: 'locked',
    },
    {
      id: 'vac-18',
      order: 18,
      name: '乙脑减毒活疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '24 月龄',
      description: '两周岁乙脑防线再加固',
      status: 'locked',
    },
    {
      id: 'vac-19',
      order: 19,
      name: '脊灰减毒疫苗',
      doseLabel: '第 4 剂',
      recommendedMonth: '4 周岁',
      description: '第 19 枚终极星环护盾激活',
      status: 'locked',
    },
  ];
}

export function createInitialAppState(todayStr: string = getTodayDateStr()): PlanetAppState {
  const d = (offset: number) => shiftDateStr(todayStr, offset);

  return {
    profile: {
      name: '',
      planetName: '未知漫游者的登陆手帐',
      birthDate: d(-41),
      gender: 'star',
      recorders: ['妈妈', '爸爸', '外婆', '奶奶'],
    },
    diaries: [
      {
        id: 'diary-1',
        date: d(0),
        content: '今天在公园看到了\n一只可爱的小猫咪，\n它懒懒地躺在草地上，\n好像在晒太阳～',
        reflection: '今天真是美好的一天呀！\n希望明天也有星星陪伴～',
        mood: 'glowing',
        weather: 'sunny',
        recorder: '妈妈',
        photos: [
          '/assets/extracted/diary_photo_cat.png',
          '/assets/extracted/diary_photo_flower.png',
          '/assets/extracted/diary_photo_grass.png',
        ],
      },
      {
        id: 'diary-2',
        date: d(-1),
        content: '晚上的星星好亮呀～\n抱着小漫游者在阳台看了好久夜空，\n他突然发出咯咯的笑声。',
        reflection: '在浩瀚星空下听见你的笑声，是最珍贵的星光碎片。',
        mood: 'floating',
        weather: 'cloudy',
        recorder: '妈妈',
        photos: [
          '/assets/extracted/diary_photo_stars.png',
          '/assets/extracted/diary_photo_cat.png',
          '/assets/extracted/diary_photo_boy.png',
        ],
      },
      {
        id: 'diary-3',
        date: d(-2),
        content: '睡前和小狗一起看星星，\n巴哥安静地趴在脚边守护，\n今天也是温柔的一天。',
        reflection: '有毛茸茸的小伙伴一起陪伴长大真好呀～',
        mood: 'soft',
        weather: 'sunny',
        recorder: '妈妈',
        photos: [
          '/assets/extracted/diary_photo_boy.png',
          '/assets/extracted/pug.png',
        ],
      },
    ],
    feedings: [
      {
        id: 'feed-1',
        date: d(0),
        time: '19:30',
        type: 'formula',
        amountMl: 120,
        note: '咕噜咕噜一口气喝完',
        recorder: '妈妈',
      },
      {
        id: 'feed-2',
        date: d(0),
        time: '13:00',
        type: 'solids',
        foodName: '菠菜泥',
        foodAmount: '30g',
        recorder: '妈妈',
      },
      {
        id: 'feed-3',
        date: d(0),
        time: '10:15',
        type: 'supplement',
        foodName: '维生素AD',
        foodAmount: '1粒',
        recorder: '爸爸',
      },
      {
        id: 'feed-4',
        date: d(0),
        time: '08:20',
        type: 'breast',
        breastSide: 'both',
        amountMl: 80,
        durationMin: 16,
        recorder: '妈妈',
      },
      {
        id: 'feed-5',
        date: d(0),
        time: '05:40',
        type: 'formula',
        amountMl: 110,
        recorder: '爸爸',
      },
      // 前几天用于双 Y 轴折线图展示的数据
      { id: 'feed-p1', date: d(-6), time: '08:00', type: 'formula', amountMl: 110, recorder: '妈妈' },
      { id: 'feed-p2', date: d(-6), time: '12:00', type: 'formula', amountMl: 120, recorder: '妈妈' },
      { id: 'feed-p3', date: d(-6), time: '16:00', type: 'formula', amountMl: 115, recorder: '爸爸' },
      { id: 'feed-p4', date: d(-5), time: '08:15', type: 'formula', amountMl: 130, recorder: '妈妈' },
      { id: 'feed-p5', date: d(-5), time: '13:00', type: 'formula', amountMl: 125, recorder: '妈妈' },
      { id: 'feed-p6', date: d(-5), time: '18:00', type: 'formula', amountMl: 130, recorder: '爸爸' },
      { id: 'feed-p7', date: d(-5), time: '21:30', type: 'breast', breastSide: 'right', durationMin: 15, recorder: '妈妈' },
      { id: 'feed-p8', date: d(-4), time: '07:40', type: 'formula', amountMl: 120, recorder: '妈妈' },
      { id: 'feed-p9', date: d(-4), time: '11:30', type: 'formula', amountMl: 140, recorder: '外婆' },
      { id: 'feed-p10', date: d(-4), time: '16:10', type: 'formula', amountMl: 135, recorder: '妈妈' },
      { id: 'feed-p11', date: d(-3), time: '08:00', type: 'formula', amountMl: 140, recorder: '妈妈' },
      { id: 'feed-p12', date: d(-3), time: '12:15', type: 'formula', amountMl: 150, recorder: '爸爸' },
      { id: 'feed-p13', date: d(-3), time: '17:00', type: 'formula', amountMl: 135, recorder: '妈妈' },
      { id: 'feed-p14', date: d(-3), time: '21:00', type: 'formula', amountMl: 130, recorder: '妈妈' },
      { id: 'feed-p15', date: d(-2), time: '07:30', type: 'formula', amountMl: 135, recorder: '妈妈' },
      { id: 'feed-p16', date: d(-2), time: '11:45', type: 'formula', amountMl: 145, recorder: '爸爸' },
      { id: 'feed-p17', date: d(-2), time: '15:50', type: 'formula', amountMl: 140, recorder: '妈妈' },
      { id: 'feed-p18', date: d(-1), time: '08:20', type: 'formula', amountMl: 150, recorder: '妈妈' },
      { id: 'feed-p19', date: d(-1), time: '12:40', type: 'formula', amountMl: 150, recorder: '外婆' },
      { id: 'feed-p20', date: d(-1), time: '17:20', type: 'formula', amountMl: 145, recorder: '爸爸' },
      { id: 'feed-p21', date: d(-1), time: '21:10', type: 'formula', amountMl: 140, recorder: '妈妈' },
    ],
    growths: [
      {
        id: 'grow-1',
        date: d(-41),
        heightCm: 50.2,
        weightKg: 3.35,
        headCm: 34.0,
        note: '初次登陆地球基准坐标',
      },
      {
        id: 'grow-2',
        date: d(-27),
        heightCm: 52.4,
        weightKg: 3.92,
        headCm: 35.1,
        note: '满两周社区儿保测量',
      },
      {
        id: 'grow-3',
        date: d(-10),
        heightCm: 54.8,
        weightKg: 4.58,
        headCm: 36.2,
        note: '满月体检：生长曲线超棒',
      },
      {
        id: 'grow-4',
        date: d(0),
        heightCm: 56.1,
        weightKg: 4.95,
        headCm: 36.9,
        note: '第 42 天清晨空腹测量',
      },
    ],
    vaccines: createVaccineSchedule19(todayStr),
    illnesses: [
      {
        id: 'ill-1',
        date: d(0),
        time: '14:30',
        careCategory: 'temperature',
        title: '体温过载',
        handled: true,
        temperatureC: 38.5,
        symptoms: ['发热', '食欲不振'],
        medication: '温水擦浴物理降温 + 退热贴 1 枚，密切监测精神状态',
        recorder: '妈妈',
      },
      {
        id: 'ill-2',
        date: d(0),
        time: '14:30',
        careCategory: 'medicine',
        title: '退烧药',
        summary: '1次',
        handled: true,
        temperatureC: 38.5,
        symptoms: ['发热'],
        medication: '遵医嘱口服退烧滴剂 1 次，30 分钟后复测体温平稳下降',
        recorder: '妈妈',
      },
      {
        id: 'ill-3',
        date: d(0),
        time: '12:00',
        careCategory: 'hydration',
        title: '多喝水',
        summary: '120ml',
        amountMl: 120,
        handled: true,
        temperatureC: 37.3,
        symptoms: ['流鼻涕'],
        medication: '少量多次补充温开水，帮助代谢散热与润喉',
        recorder: '爸爸',
      },
    ],
    checklist: [
      {
        id: 'chk-1',
        title: '俯卧抬头宇宙瞭望',
        subtitle: '累计 3-5 分钟，锻炼颈背力量',
        completed: true,
      },
      {
        id: 'chk-2',
        title: '黑白星图视觉追视',
        subtitle: '距眼睛 20cm 左右缓慢移动卡面',
        completed: true,
      },
      {
        id: 'chk-3',
        title: '温柔抚触与被动操',
        subtitle: '沐浴后配合抚触油轻柔按摩四肢',
        completed: false,
      },
      {
        id: 'chk-4',
        title: '摇篮曲与绘本共读',
        subtitle: '睡前轻声讲述星球登陆小故事',
        completed: false,
      },
    ],
  };
}

export function calculatePlanetAge(birthDateStr: string, targetDateStr: string = getTodayDateStr()) {
  if (!birthDateStr) {
    return null;
  }
  const birth = new Date(birthDateStr + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
    return null;
  }
  const diffDays = Math.floor((target.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const isFuture = diffDays < 0;
  const daysUntil = isFuture ? Math.abs(diffDays) : 0;
  const days = Math.max(1, diffDays + 1);
  const weeks = Math.max(1, Math.ceil(days / 7));
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  return {
    days,
    weeks,
    months,
    remDays,
    isFuture,
    daysUntil,
    label: isFuture
      ? `距离登陆地球还有 ${daysUntil} 天`
      : `登陆地球的第 ${days} 天 / 第 ${weeks} 周`,
    detailLabel: isFuture
      ? `距离预计登陆日还有 ${daysUntil} 天`
      : months > 0
      ? `${months} 个月 ${remDays} 天（第 ${days} 天）`
      : `第 ${days} 天 · 第 ${weeks} 周`,
  };
}

export function formatTypewriterDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const days = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}  ${days[d.getDay()]}`;
}

export const REFERENCE_TODAY = getTodayDateStr();
export const VACCINE_SCHEDULE_19 = createVaccineSchedule19(REFERENCE_TODAY);
export const INITIAL_APP_STATE = createInitialAppState(REFERENCE_TODAY);
