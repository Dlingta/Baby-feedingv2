import { VaccineChoiceOption, VaccineDose } from '../types/planet';

function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateStr(): string {
  return formatYmdLocal(new Date());
}

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return getTodayDateStr();
  d.setDate(d.getDate() + deltaDays);
  return formatYmdLocal(d);
}

// 复用型选项组：与预防接种门诊知情告知表完全对应

const PCV13_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'pcv13-pfizer',
    label: '13价肺炎（进口·辉瑞 沛儿13）',
    shortTag: '进口',
    fundingType: '自费',
    brandOrigin: '进口',
    brandName: '辉瑞·沛儿13',
    priceHint: '约 ¥727.5/剂',
    detailNote: '需在 6 周龄起接种，基础 3 针须在 1 岁生日前完成',
  },
  {
    id: 'pcv13-walvax',
    label: '13价肺炎（国产·沃森 沃安欣）',
    shortTag: '国产',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '沃森·沃安欣',
    priceHint: '约 ¥627.5/剂',
    detailNote: '国产 13 价，适用年龄放宽至 5 岁，大月龄也能补种',
  },
  {
    id: 'pcv13-kangtai',
    label: '13价肺炎（国产·康泰民海 维民菲宝）',
    shortTag: '国产',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '康泰民海·维民菲宝',
    priceHint: '约 ¥487.5/剂',
    detailNote: '国产双载体 13 价，性价比高，适用 6 周龄至 5 岁',
  },
];

const ROTAVIRUS_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'rota-5-import',
    label: '五价轮状病毒疫苗（进口·默沙东 乐儿德）',
    shortTag: '五价·进口',
    fundingType: '自费',
    brandOrigin: '进口',
    brandName: '默沙东·乐儿德',
    priceHint: '约 ¥309.5/剂',
    detailNote: '预防 5 种血清型，口服共 3 剂；3 月龄前首剂，8 月龄前完成',
  },
  {
    id: 'rota-3-domestic',
    label: '三价轮状病毒疫苗（国产·兰生所）',
    shortTag: '三价·国产',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '兰州生物所·三价轮状',
    priceHint: '约 ¥247.5/剂',
    detailNote: '预防 3 种血清型，口服共 3 剂；3 月龄前首剂，8 月龄前完成',
  },
];

const MEN_AC_INFANT_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'men-a-free',
    label: 'A群流脑多糖疫苗（免疫规划免费）',
    shortTag: '免费必打',
    fundingType: '免费',
    brandOrigin: '国产',
    brandName: '免疫规划免费苗',
    priceHint: '免费',
    detailNote: '国家免疫规划免费提供（门诊多安排每周一至周五上午集中接种）',
  },
  {
    id: 'men-ac-conj',
    label: 'AC群流脑结合疫苗（自费替代）',
    shortTag: 'AC结合·自费',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '国产 AC 结合疫苗',
    priceHint: '约 ¥187.5/剂',
    detailNote: '多糖结合工艺，对小月龄免疫记忆更强，同时防 A/C 两群',
  },
  {
    id: 'men-acyw135-conj',
    label: 'ACYW135流脑结合疫苗（自费升级·曼海欣）',
    shortTag: '四价结合·自费',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '康希诺·曼海欣',
    priceHint: '约 ¥449.5/剂',
    detailNote: '四价结合工艺，覆盖 A/C/Y/W135 四群，防护最全面',
  },
];

const MEN_AC_OLDER_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'men-ac-free',
    label: 'A+C群流脑多糖疫苗（免疫规划免费）',
    shortTag: '免费必打',
    fundingType: '免费',
    brandOrigin: '国产',
    brandName: '免疫规划免费苗',
    priceHint: '免费',
    detailNote: '国家免疫规划 3 岁 / 6 岁免费加强针',
  },
  {
    id: 'men-acyw135-poly',
    label: 'ACYW135流脑多糖疫苗（自费替代）',
    shortTag: '四价多糖·自费',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '国产 ACYW135 多糖',
    priceHint: '约 ¥165.5/剂',
    detailNote: '覆盖 A/C/Y/W135 四群，替代免费 AC 多糖',
  },
  {
    id: 'men-acyw135-conj-older',
    label: 'ACYW135流脑结合疫苗（自费升级·曼海欣）',
    shortTag: '四价结合·自费',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '康希诺·曼海欣',
    priceHint: '约 ¥449.5/剂',
    detailNote: '四价结合疫苗，保护持久力更强',
  },
];

const EV71_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'ev71-sinovac',
    label: 'EV71 手足口疫苗（国产·科兴 益尔来福）',
    shortTag: 'Vero细胞',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '北京科兴·益尔来福',
    priceHint: '约 ¥217.5/剂',
    detailNote: '预防 EV71 病毒引起的重症手足口病，共 2 剂（间隔 1 个月）',
  },
  {
    id: 'ev71-imbcams',
    label: 'EV71 手足口疫苗（国产·医科院昆明所）',
    shortTag: '人二倍体',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '医科院昆明所·EV71',
    priceHint: '约 ¥217.5/剂',
    detailNote: '人二倍体细胞工艺，共 2 剂，建议 1 岁前完成',
  },
  {
    id: 'ev71-wuhan',
    label: 'EV71 手足口疫苗（国产·武汉生物所）',
    shortTag: 'Vero细胞',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '武汉生物所·EV71',
    priceHint: '约 ¥217.5/剂',
    detailNote: '预防重症手足口病，共 2 剂',
  },
];

const FLU_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'flu-quad-split',
    label: '四价流感裂解疫苗（国产/华兰·科兴等）',
    shortTag: '四价裂解',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '国产四价流感疫苗',
    priceHint: '以门诊当季定价为准',
    detailNote: '覆盖甲型 H1N1/H3N2 与乙型两系，6 月龄以上每年秋季接种',
  },
  {
    id: 'flu-quad-subunit',
    label: '四价流感亚单位疫苗（国产·慧尔康欣）',
    shortTag: '四价亚单位',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '中慧元通·四价亚单位',
    priceHint: '以门诊当季定价为准',
    detailNote: '抗原纯度更高，局部红肿发热等副反应相对更轻',
  },
  {
    id: 'flu-tri-import',
    label: '三价/四价进口流感疫苗（赛诺菲·凡尔灵）',
    shortTag: '进口',
    fundingType: '自费',
    brandOrigin: '进口',
    brandName: '赛诺菲·凡尔灵',
    priceHint: '以门诊当季定价为准',
    detailNote: '进口裂解疫苗，具体以当年门诊到苗为准',
  },
];

const VARICELLA_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'varicella-changchun',
    label: '水痘减毒活疫苗（国产·百克/祈健/科兴）',
    shortTag: '国产自费',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '国产水痘疫苗',
    priceHint: '约 ¥155.5–197.5/剂',
    detailNote: '1 岁首剂，4 岁加强第 2 剂，保护率可达 95% 以上',
  },
];

const ORAL_SINGLE_ROTA_OPTIONS: VaccineChoiceOption[] = [
  {
    id: 'rota-1-lanzhou',
    label: '单价口服轮状病毒疫苗（国产·罗特威）',
    shortTag: '单价·国产',
    fundingType: '自费',
    brandOrigin: '国产',
    brandName: '兰生所·罗特威',
    priceHint: '约 ¥167.5/剂',
    detailNote: '适合未接种五价/三价轮状的宝宝，每年口服 1 剂（2 月龄至 3 岁）',
  },
];

export const CLINIC_VACCINE_TIPS: string[] = [
  '免疫规划疫苗由政府出资免费接种（必打）；非免疫规划疫苗由家长自愿自费选择，部分可替代免费疫苗减少扎针。',
  '五联 = IPV（脊灰灭活）+ 百白破 + Hib，1 苗防 5 病，全程少打 8 针且无脊灰减毒风险；四联 = 百白破 + Hib（需另配脊灰）。',
  '五价轮状（进口）与三价轮状（国产）为二选一，均须在 3 月龄前完成第 1 剂、8 月龄前完成全部 3 剂。',
  '口服疫苗（口服脊灰、轮状病毒、霍乱疫苗）接种前后半小时内不要吃热食（含热水、热牛奶、母乳）。',
  '13 价肺炎进口辉瑞首针年龄要求严（1 岁前须完成基础 3 针），国产沃森/康泰放宽至 5 岁内均可补种。',
];

/**
 * 依据「天元区泰山社区预防接种门诊疫苗接种知情告知」整理的完整儿童疫苗接种计划：
 * - 保留旧版 vac-1 ~ vac-19 ID，确保老用户已打卡记录 100% 兼容不丢失
 * - 补全 1.5/2.5/3.5/5/6.5/7.5/8.5/9.5 月龄及 1~9 岁全部免费必打与自费可选/替代项目
 */
export function createFullClinicVaccineSchedule(
  todayStr: string = getTodayDateStr()
): VaccineDose[] {
  const birthDate = shiftDateStr(todayStr, -41);
  const oneMonthDate = shiftDateStr(todayStr, -10);

  return [
    // ==================== 出生 24h 内 ====================
    {
      id: 'vac-2',
      order: 1,
      name: '卡介苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '出生 24h 内',
      description: '预防儿童重症结核病，左上臂专属星印护盾',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费，无自费替代）',
      options: [
        {
          id: 'bcg-free',
          label: '卡介苗（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '出生 24 小时内产房免费接种，仅需 1 剂',
        },
      ],
      status: 'activated',
      inoculatedDate: birthDate,
      selectedOptionId: 'bcg-free',
      selectedOptionLabel: '卡介苗（免疫规划免费）',
      brandOrigin: '国产',
      brandName: '免疫规划免费苗',
      fundingType: '免费',
      note: '左臂轻微红晕，属正常反应',
    },
    {
      id: 'vac-1',
      order: 2,
      name: '乙肝疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '出生 24h 内',
      description: '登陆地球第一份乙肝防护护盾',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费）',
      options: [
        {
          id: 'hepb-1-free',
          label: '乙肝疫苗①（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '出生 24 小时内尽早完成首剂',
        },
      ],
      status: 'activated',
      inoculatedDate: birthDate,
      selectedOptionId: 'hepb-1-free',
      selectedOptionLabel: '乙肝疫苗①（免疫规划免费）',
      brandOrigin: '国产',
      brandName: '免疫规划免费苗',
      fundingType: '免费',
      note: '产房内顺利激活，无异常哭闹',
    },

    // ==================== 1 月龄 ====================
    {
      id: 'vac-3',
      order: 3,
      name: '乙肝疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '1 月龄',
      description: '巩固乙肝防御力场，可选免费或自费替代苗',
      planCategory: 'mandatory',
      selectionHint: '免费必打 / 可选自费替代（二选一）',
      options: [
        {
          id: 'hepb-2-free',
          label: '乙肝疫苗②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '国家免疫规划免费提供，保护效果良好',
        },
        {
          id: 'hepb-2-paid',
          label: '乙肝疫苗②（自费替代·进口/酿酒酵母）',
          shortTag: '自费替代',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '葛兰素史克 / 深圳康泰重组',
          priceHint: '约 ¥117.5/剂',
          detailNote: '自费替代乙肝疫苗，抗体阳转率高',
        },
      ],
      status: 'activated',
      inoculatedDate: oneMonthDate,
      selectedOptionId: 'hepb-2-free',
      selectedOptionLabel: '乙肝疫苗②（免疫规划免费）',
      brandOrigin: '国产',
      brandName: '免疫规划免费苗',
      fundingType: '免费',
      note: '接种后多喝温水，睡眠香甜',
    },

    // ==================== 1.5 月龄 ====================
    {
      id: 'vac-opt-pcv13-1',
      order: 4,
      name: '13价肺炎疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '1.5 月龄',
      description: '预防 13 种肺炎球菌引起的肺炎、中耳炎与脑膜炎',
      planCategory: 'optional',
      selectionHint: '自费可选 · 进口辉瑞 / 国产沃森 / 国产康泰 三选一',
      options: PCV13_OPTIONS,
      status: 'next',
    },
    {
      id: 'vac-opt-rota-1',
      order: 5,
      name: '五价/三价轮状病毒疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '1.5 月龄',
      description: '口服预防婴幼儿秋季重症腹泻',
      planCategory: 'optional',
      selectionHint: '自费可选 · 五价进口 / 三价国产 二选一',
      clinicTip: '口服疫苗前后半小时内不要喝热奶、热水或吃热食；首剂须在 3 月龄前完成。',
      options: ROTAVIRUS_OPTIONS,
      status: 'locked',
    },

    // ==================== 2 月龄 ====================
    {
      id: 'vac-4',
      order: 6,
      name: '脊灰灭活① + 百白破①（或五联①）',
      doseLabel: '第 1 剂',
      recommendedMonth: '2 月龄',
      description: '防脊髓灰质炎与百白破；可选自费进口五联替代少扎针',
      planCategory: 'mandatory',
      selectionHint: '免费必打 / 可自费选「五联①」替代（含 Hib）',
      options: [
        {
          id: 'm2-free',
          label: '脊灰灭活① + 百白破①（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '按国家免疫规划免费接种脊灰灭活（IPV）与百白破',
        },
        {
          id: 'm2-penta-1',
          label: '五联疫苗①（自费替代·进口 潘太欣）',
          shortTag: '五联替代·进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '赛诺菲·潘太欣',
          priceHint: '约 ¥628.5/剂',
          detailNote: '1 苗防 5 病（IPV+百白破+Hib），全程少打 8 针且全程灭活',
        },
      ],
      status: 'locked',
    },

    // ==================== 2.5 月龄 ====================
    {
      id: 'vac-opt-pcv13-2',
      order: 7,
      name: '13价肺炎疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '2.5 月龄',
      description: '建议与第 1 剂保持同品牌接种',
      planCategory: 'optional',
      selectionHint: '自费可选 · 进口辉瑞 / 国产沃森 / 国产康泰 三选一',
      options: PCV13_OPTIONS,
      status: 'locked',
    },
    {
      id: 'vac-opt-rota-2',
      order: 8,
      name: '五价/三价轮状病毒疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '2.5 月龄',
      description: '与第 1 剂保持同一价次，间隔 4–10 周口服',
      planCategory: 'optional',
      selectionHint: '自费可选 · 五价进口 / 三价国产 二选一',
      clinicTip: '口服前后半小时内禁热奶、热水与热食。',
      options: ROTAVIRUS_OPTIONS,
      status: 'locked',
    },

    // ==================== 3 月龄 ====================
    {
      id: 'vac-5',
      order: 9,
      name: '脊灰灭活②（或五联② / 四联① / Hib①）',
      doseLabel: '第 2 剂',
      recommendedMonth: '3 月龄',
      description: '加固脊灰防线；如走五联/四联/Hib 路线在此记录',
      planCategory: 'mandatory',
      selectionHint: '免费必打 / 可自费选 五联② / 四联① / Hib①',
      options: [
        {
          id: 'm3-ipv-free',
          label: '脊灰灭活疫苗②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '国家免疫规划免费脊灰灭活针剂',
        },
        {
          id: 'm3-penta-2',
          label: '五联疫苗②（自费替代·进口 潘太欣）',
          shortTag: '五联替代·进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '赛诺菲·潘太欣',
          priceHint: '约 ¥628.5/剂',
          detailNote: '已覆盖脊灰② + 百白破 + Hib，无需再单独打免费苗',
        },
        {
          id: 'm3-tetra-1',
          label: '四联疫苗①（自费·国产 康泰民海）+ 免费脊灰②',
          shortTag: '四联·国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '康泰民海·四联疫苗',
          priceHint: '约 ¥397.5/剂',
          detailNote: '含百白破 + Hib，需另配合免费脊灰灭活②',
        },
        {
          id: 'm3-hib-1',
          label: 'Hib 疫苗①（自费单苗）+ 免费脊灰②',
          shortTag: 'Hib单苗',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 Hib 结合疫苗',
          priceHint: '约 ¥134.5/剂',
          detailNote: '预防 b 型流感嗜血杆菌脑膜炎/肺炎，搭配免费脊灰②',
        },
      ],
      status: 'locked',
    },

    // ==================== 3.5 月龄 ====================
    {
      id: 'vac-opt-pcv13-3',
      order: 10,
      name: '13价肺炎疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '3.5 月龄',
      description: '完成 13 价肺炎基础 3 针免疫',
      planCategory: 'optional',
      selectionHint: '自费可选 · 进口辉瑞 / 国产沃森 / 国产康泰 三选一',
      options: PCV13_OPTIONS,
      status: 'locked',
    },
    {
      id: 'vac-opt-rota-3',
      order: 11,
      name: '五价/三价轮状病毒疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '3.5 月龄',
      description: '完成轮状病毒全程 3 剂口服（须在 8 月龄前完成）',
      planCategory: 'optional',
      selectionHint: '自费可选 · 五价进口 / 三价国产 二选一',
      clinicTip: '口服前后半小时内不要吃热食/喝热奶；第 3 剂须在 8 月龄前完成。',
      options: ROTAVIRUS_OPTIONS,
      status: 'locked',
    },

    // ==================== 4 月龄 ====================
    {
      id: 'vac-7',
      order: 12,
      name: '口服脊灰① + 百白破②（或五联③ / 四联② / Hib②）',
      doseLabel: '第 3 剂',
      recommendedMonth: '4 月龄',
      description: '免费口服脊灰 + 百白破②；或按五联③ / 四联② / Hib② 方案接种',
      planCategory: 'mandatory',
      selectionHint: '免费必打 / 可自费选 五联③ / 四联② / Hib②',
      clinicTip: '若接种免费口服脊灰（bOPV），前后半小时内勿喝热奶或热水。',
      options: [
        {
          id: 'm4-free',
          label: '口服脊灰① + 百白破②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '口服脊灰减毒滴剂 + 免费百白破第 2 剂',
        },
        {
          id: 'm4-penta-3',
          label: '五联疫苗③（自费替代·进口 潘太欣）',
          shortTag: '五联替代·进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '赛诺菲·潘太欣',
          priceHint: '约 ¥628.5/剂',
          detailNote: '完成五联基础 3 针，全程注射灭活无口服脊灰风险',
        },
        {
          id: 'm4-tetra-2',
          label: '四联疫苗②（自费·国产 康泰民海）+ 免费脊灰',
          shortTag: '四联·国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '康泰民海·四联疫苗',
          priceHint: '约 ¥397.5/剂',
          detailNote: '替代百白破②并含 Hib②，需配合免费口服脊灰①',
        },
        {
          id: 'm4-hib-2',
          label: 'Hib 疫苗②（自费单苗）+ 免费苗',
          shortTag: 'Hib单苗',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 Hib 结合疫苗',
          priceHint: '约 ¥134.5/剂',
          detailNote: '搭配免费脊灰 + 百白破接种',
        },
      ],
      status: 'locked',
    },

    // ==================== 5 月龄 ====================
    {
      id: 'vac-opt-m5',
      order: 13,
      name: '四联③ / Hib③ / 单价口服轮状①',
      doseLabel: '选配剂次',
      recommendedMonth: '5 月龄',
      description: '如未选五联，可在 5 月龄完成四联③或 Hib③；未服五/三价轮状可选单价轮状',
      planCategory: 'optional',
      selectionHint: '自费可选 · 四联③ / Hib③ / 单价口服轮状①',
      clinicTip: '如选择单价口服轮状，前后半小时内忌热奶热食；已打五联则无需四联/Hib。',
      options: [
        {
          id: 'm5-tetra-3',
          label: '四联疫苗③（国产·康泰民海）',
          shortTag: '四联·国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '康泰民海·四联疫苗',
          priceHint: '约 ¥397.5/剂',
          detailNote: '完成四联基础 3 针（替代百白破+Hib）',
        },
        {
          id: 'm5-hib-3',
          label: 'Hib 疫苗③（国产自费单苗）',
          shortTag: 'Hib单苗',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 Hib 结合疫苗',
          priceHint: '约 ¥134.5/剂',
          detailNote: '完成 Hib 基础 3 针',
        },
        ...ORAL_SINGLE_ROTA_OPTIONS,
      ],
      status: 'locked',
    },

    // ==================== 6 月龄 ====================
    {
      id: 'vac-9',
      order: 14,
      name: '百白破疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '6 月龄',
      description: '完成基础百白破三联防护（若选五联/四联则已包含）',
      planCategory: 'mandatory',
      selectionHint: '免费必打（若已打五联/四联可标记为联合苗已覆盖）',
      options: [
        {
          id: 'dtap-3-free',
          label: '百白破疫苗③（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '走免费免疫规划方案的宝宝在此接种百白破第 3 剂',
        },
        {
          id: 'dtap-3-covered',
          label: '已由五联③ / 四联③覆盖（无需重复接种）',
          shortTag: '联合苗已覆盖',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '五联 / 四联已覆盖',
          priceHint: '无需再付费',
          detailNote: '若 2–5 月龄已完成五联或四联基础 3 针，可直接打卡标记已完成',
        },
      ],
      status: 'locked',
    },
    {
      id: 'vac-10',
      order: 15,
      name: '乙肝疫苗',
      doseLabel: '第 3 剂',
      recommendedMonth: '6 月龄',
      description: '完成乙肝全程 3 针，建立长期抗体记忆',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费）',
      options: [
        {
          id: 'hepb-3-free',
          label: '乙肝疫苗③（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '完成 0-1-6 月龄全程乙肝免疫',
        },
        {
          id: 'hepb-3-paid',
          label: '乙肝疫苗③（自费替代苗）',
          shortTag: '自费替代',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '自费重组乙肝疫苗',
          priceHint: '约 ¥117.5/剂',
          detailNote: '如第 2 剂选自费替代苗可继续同款完成',
        },
      ],
      status: 'locked',
    },

    // ==================== 6.5 月龄 ====================
    {
      id: 'vac-11',
      order: 16,
      name: '流脑疫苗（流脑A① / AC结合① / ACYW135结合①）',
      doseLabel: '第 1 剂',
      recommendedMonth: '6.5 月龄',
      description: '预防流行性脑脊髓膜炎；可选免费多糖或自费升级结合疫苗',
      planCategory: 'mandatory',
      selectionHint: '免费流脑A① / 自费 AC结合① / 自费 ACYW135结合① 三选一',
      clinicTip: '免费流脑 A 群 5 人份通常安排在每周一至周五上午集中接种。',
      options: MEN_AC_INFANT_OPTIONS,
      status: 'locked',
    },
    {
      id: 'vac-opt-ev71-1',
      order: 17,
      name: 'EV71 手足口疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '6.5 月龄',
      description: '预防 EV71 病毒引起的重症手足口病',
      planCategory: 'optional',
      selectionHint: '自费可选 · 国产科兴 / 昆明所 / 武汉所',
      options: EV71_OPTIONS,
      status: 'locked',
    },

    // ==================== 7.5 月龄 ====================
    {
      id: 'vac-opt-men-2',
      order: 18,
      name: '流脑结合疫苗（AC结合② / ACYW135结合②）',
      doseLabel: '第 2 剂',
      recommendedMonth: '7.5 月龄',
      description: '若 6.5 月龄选择了自费流脑结合疫苗，间隔 1 个月打第 2 剂',
      planCategory: 'optional',
      selectionHint: '自费替代 · AC结合② / ACYW135结合② 二选一',
      options: MEN_AC_INFANT_OPTIONS.slice(1),
      status: 'locked',
    },
    {
      id: 'vac-opt-ev71-2',
      order: 19,
      name: 'EV71 手足口疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '7.5 月龄',
      description: '与第 1 剂间隔 1 个月，完成手足口病全程免疫',
      planCategory: 'optional',
      selectionHint: '自费可选 · 与第 1 剂同品牌',
      options: EV71_OPTIONS,
      status: 'locked',
    },

    // ==================== 8 月龄 ====================
    {
      id: 'vac-12',
      order: 20,
      name: '麻腮风疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '8 月龄',
      description: '抵御麻疹、流行性腮腺炎与风疹（免疫规划必打）',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费，无自费替代）',
      options: [
        {
          id: 'mmr-1-free',
          label: '麻腮风疫苗①（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '8 月龄必打免费苗，部分宝宝接种后 5–12 天可能轻微低热或出疹',
        },
      ],
      status: 'locked',
    },
    {
      id: 'vac-13',
      order: 21,
      name: '乙脑疫苗（减毒① / 自费灭活①）',
      doseLabel: '第 1 剂',
      recommendedMonth: '8 月龄',
      description: '预防流行性乙型脑炎，可选免费减毒或自费灭活替代',
      planCategory: 'mandatory',
      selectionHint: '免费减毒① / 自费灭活① 二选一',
      options: [
        {
          id: 'je-1-free',
          label: '乙脑减毒活疫苗①（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '全程仅需 2 剂（8 月龄、2 岁），保护效力好',
        },
        {
          id: 'je-1-inact',
          label: '乙脑灭活疫苗①（自费替代）',
          shortTag: '灭活·自费',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产乙脑灭活疫苗',
          priceHint: '约 ¥155.5/剂',
          detailNote: '适合免疫功能低下或有热性惊厥史宝宝，需 8/8.5 月龄及 2/6 岁共 4 剂',
        },
      ],
      status: 'locked',
    },

    // ==================== 8.5 月龄 ====================
    {
      id: 'vac-opt-je-inact-2',
      order: 22,
      name: '乙脑灭活疫苗（替代方案）',
      doseLabel: '第 2 剂',
      recommendedMonth: '8.5 月龄',
      description: '仅当 8 月龄选择了「自费乙脑灭活①」时，间隔 7–10 天接种第 2 剂',
      planCategory: 'optional',
      selectionHint: '自费替代专用（选免费乙脑减毒无需打此针）',
      options: [
        {
          id: 'je-2-inact',
          label: '乙脑灭活疫苗②（自费替代）',
          shortTag: '灭活·自费',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产乙脑灭活疫苗',
          priceHint: '约 ¥155.5/剂',
          detailNote: '与乙脑灭活①间隔 7–10 天接种',
        },
      ],
      status: 'locked',
    },

    // ==================== 9.5 月龄 ====================
    {
      id: 'vac-14',
      order: 23,
      name: '流脑A群疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '9.5 月龄',
      description: '巩固流脑基础防护（如已接种自费 AC/ACYW135 结合疫苗则按结合程序）',
      planCategory: 'mandatory',
      selectionHint: '免费必打（走免费流脑A方案）',
      clinicTip: '流脑 A 群 5 人份通常每周一至周五上午集中接种。',
      options: [
        {
          id: 'men-a-2-free',
          label: 'A群流脑多糖疫苗②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '与流脑 A① 间隔 3 个月免费接种',
        },
        {
          id: 'men-a-2-covered',
          label: '已选 AC / ACYW135 结合方案覆盖',
          shortTag: '结合苗替代',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '流脑结合疫苗已替代',
          priceHint: '无需重复付费',
          detailNote: '已在 6.5/7.5 月龄走流脑结合疫苗流程的宝宝可直接打卡标记',
        },
      ],
      status: 'locked',
    },
    {
      id: 'vac-opt-flu-1',
      order: 24,
      name: '流感疫苗（季节性）',
      doseLabel: '首季接种',
      recommendedMonth: '9.5 月龄',
      description: '6 月龄以上儿童每年秋冬季建议接种，首次接种需 2 剂（间隔 1 个月）',
      planCategory: 'optional',
      selectionHint: '自费可选 · 四价裂解 / 亚单位 / 进口',
      options: FLU_OPTIONS,
      status: 'locked',
    },

    // ==================== 1 岁 ====================
    {
      id: 'vac-opt-pcv13-4',
      order: 25,
      name: '13价肺炎疫苗',
      doseLabel: '第 4 剂（加强）',
      recommendedMonth: '1 岁',
      description: '12–15 月龄加强 1 针，锁定持久肺炎球菌保护',
      planCategory: 'optional',
      selectionHint: '自费可选 · 进口辉瑞 / 国产沃森 / 国产康泰 三选一',
      options: PCV13_OPTIONS,
      status: 'locked',
    },
    {
      id: 'vac-opt-varicella-1',
      order: 26,
      name: '水痘疫苗',
      doseLabel: '第 1 剂',
      recommendedMonth: '1 岁',
      description: '预防水痘与带状疱疹，托幼前必备保护',
      planCategory: 'optional',
      selectionHint: '自费可选 · 国产水痘减毒活疫苗',
      options: VARICELLA_OPTIONS,
      status: 'locked',
    },

    // ==================== 1 岁 6 月龄 ====================
    {
      id: 'vac-17',
      order: 27,
      name: '麻腮风疫苗',
      doseLabel: '第 2 剂',
      recommendedMonth: '1 岁 6 月龄',
      description: '18 月龄麻腮风加强针，建立长效免疫记忆',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费）',
      options: [
        {
          id: 'mmr-2-free',
          label: '麻腮风疫苗②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '完成麻腮风全程 2 剂',
        },
      ],
      status: 'locked',
    },
    {
      id: 'vac-15',
      order: 28,
      name: '甲肝疫苗（减毒① / 自费灭活①）',
      doseLabel: '第 1 剂',
      recommendedMonth: '1 岁 6 月龄',
      description: '预防甲型病毒性肝炎，可选免费减毒（1 剂）或自费灭活（2 剂）',
      planCategory: 'mandatory',
      selectionHint: '免费减毒① / 自费灭活① 二选一',
      options: [
        {
          id: 'hepa-1-free',
          label: '甲肝减毒活疫苗①（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '仅需 1 剂即可完成甲肝免疫规划',
        },
        {
          id: 'hepa-1-inact',
          label: '甲肝灭活疫苗①（自费替代）',
          shortTag: '灭活·自费',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '科兴孩尔来福 / 葛兰素史克',
          priceHint: '约 ¥167.5/剂',
          detailNote: '安全性高，需在 2 岁时接种第 2 剂加强',
        },
      ],
      status: 'locked',
    },

    // ==================== 1 岁 6.5 月龄 ====================
    {
      id: 'vac-16',
      order: 29,
      name: '百白破④（或五联④ / 四联④ / Hib④）',
      doseLabel: '第 4 剂（加强）',
      recommendedMonth: '1 岁 6.5 月龄',
      description: '一岁半加强免疫，按前期路线选择免费百白破或五联/四联/Hib 加强',
      planCategory: 'mandatory',
      selectionHint: '免费百白破④ / 自费 五联④ / 四联④ / Hib④',
      options: [
        {
          id: 'm18-dtap-free',
          label: '百白破疫苗④（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '免疫规划免费加强针',
        },
        {
          id: 'm18-penta-4',
          label: '五联疫苗④（自费替代·进口 潘太欣）',
          shortTag: '五联加强·进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '赛诺菲·潘太欣',
          priceHint: '约 ¥628.5/剂',
          detailNote: '完成五联全程 4 针（一并加强脊灰+百白破+Hib）',
        },
        {
          id: 'm18-tetra-4',
          label: '四联疫苗④（自费替代·国产 康泰民海）',
          shortTag: '四联加强·国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '康泰民海·四联疫苗',
          priceHint: '约 ¥397.5/剂',
          detailNote: '一并加强百白破 + Hib',
        },
        {
          id: 'm18-hib-4',
          label: 'Hib 疫苗④（自费单苗加强）',
          shortTag: 'Hib加强',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 Hib 结合疫苗',
          priceHint: '约 ¥134.5/剂',
          detailNote: '单独加强 Hib，搭配免费百白破④',
        },
      ],
      status: 'locked',
    },

    // ==================== 1 岁 7 月龄 ====================
    {
      id: 'vac-opt-rota-single-2',
      order: 30,
      name: '单价口服轮状疫苗',
      doseLabel: '第 2 剂（选配）',
      recommendedMonth: '1 岁 7 月龄',
      description: '仅走国产单价轮状路线的宝宝每年补充 1 剂（已完成五价/三价无需再服）',
      planCategory: 'optional',
      selectionHint: '自费可选 · 国产单价罗特威',
      clinicTip: '口服前后半小时内不要吃热食/喝热奶。',
      options: ORAL_SINGLE_ROTA_OPTIONS,
      status: 'locked',
    },

    // ==================== 2 岁 ====================
    {
      id: 'vac-18',
      order: 31,
      name: '乙脑②（减毒② / 自费灭活③ / 甲肝灭活②）',
      doseLabel: '2 岁加强',
      recommendedMonth: '2 岁',
      description: '2 周岁乙脑加强；若前期选甲肝灭活则同期打甲肝灭活②',
      planCategory: 'mandatory',
      selectionHint: '免费乙脑减毒② / 自费甲肝灭活② / 自费乙脑灭活③',
      options: [
        {
          id: 'y2-je-free',
          label: '乙脑减毒活疫苗②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '完成免费乙脑全程 2 剂',
        },
        {
          id: 'y2-hepa-2-inact',
          label: '甲肝灭活疫苗②（自费替代）',
          shortTag: '甲肝灭活·自费',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产/进口甲肝灭活疫苗',
          priceHint: '约 ¥167.5/剂',
          detailNote: '18 月龄选甲肝灭活①的宝宝满 2 岁完成第 2 剂',
        },
        {
          id: 'y2-je-3-inact',
          label: '乙脑灭活疫苗③（自费替代）',
          shortTag: '乙脑灭活·自费',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产乙脑灭活疫苗',
          priceHint: '约 ¥155.5/剂',
          detailNote: '前期选乙脑灭活路线的第 3 剂加强',
        },
      ],
      status: 'locked',
    },

    // ==================== 2 岁 1 月龄 ====================
    {
      id: 'vac-opt-ppv23',
      order: 32,
      name: '23价肺炎疫苗（或霍乱疫苗）',
      doseLabel: '2 岁选配',
      recommendedMonth: '2 岁 1 月龄',
      description: '体弱易感儿可选 23 价肺炎（已打完 13 价一般无需再打）；霍乱按需口服',
      planCategory: 'optional',
      selectionHint: '自费按需 · 23价肺炎（国产/进口）或 霍乱疫苗',
      options: [
        {
          id: 'ppv23-dom',
          label: '23价肺炎多糖疫苗（国产）',
          shortTag: '国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 23 价肺炎疫苗',
          priceHint: '约 ¥229.5/剂',
          detailNote: '2 岁以上体弱或未打过 13 价肺炎的宝宝可选',
        },
        {
          id: 'ppv23-imp',
          label: '23价肺炎多糖疫苗（进口·默沙东 纽莫法）',
          shortTag: '进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '默沙东·纽莫法',
          priceHint: '约 ¥277.5/剂',
          detailNote: '进口 23 价肺炎多糖疫苗',
        },
        {
          id: 'cholera-oral',
          label: '口服霍乱疫苗（0/7/28 天连续 3 次）',
          shortTag: '口服3剂',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产重组 B 亚单位霍乱疫苗',
          priceHint: '约 ¥124.5 × 3',
          detailNote: '2 岁以上按需选配，口服前后半小时忌热食',
        },
      ],
      status: 'locked',
    },

    // ==================== 3 岁 ====================
    {
      id: 'vac-opt-men-y3',
      order: 33,
      name: '流脑AC①（或自费 ACYW135）',
      doseLabel: '3 岁加强',
      recommendedMonth: '3 岁',
      description: '3 周岁流脑加强，可选免费 AC 多糖或自费四价流脑升级',
      planCategory: 'mandatory',
      selectionHint: '免费流脑AC① / 自费 ACYW135多糖 / ACYW135结合 三选一',
      options: MEN_AC_OLDER_OPTIONS,
      status: 'locked',
    },

    // ==================== 4 岁 ====================
    {
      id: 'vac-19',
      order: 34,
      name: '口服脊灰减毒疫苗',
      doseLabel: '第 4 剂（加强）',
      recommendedMonth: '4 岁',
      description: '4 周岁脊灰终极星环护盾（若全程接种五联亦须按医嘱核对是否需加强）',
      planCategory: 'mandatory',
      selectionHint: '免疫规划必打（免费）',
      clinicTip: '口服脊灰滴剂前后半小时内不要吃热食、喝热水或热牛奶。',
      options: [
        {
          id: 'opv-4-free',
          label: '口服脊灰减毒疫苗（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '4 岁脊灰加强剂次',
        },
      ],
      status: 'locked',
    },
    {
      id: 'vac-opt-varicella-2',
      order: 35,
      name: '水痘疫苗',
      doseLabel: '第 2 剂（加强）',
      recommendedMonth: '4 岁',
      description: '4 周岁水痘第 2 剂加强，有效预防突破性水痘感染',
      planCategory: 'optional',
      selectionHint: '自费可选 · 国产水痘疫苗',
      options: VARICELLA_OPTIONS,
      status: 'locked',
    },

    // ==================== 6 岁 ====================
    {
      id: 'vac-opt-y6-dt',
      order: 36,
      name: '百白破/白破疫苗 + 流脑AC②',
      doseLabel: '6 岁入学前加强',
      recommendedMonth: '6 岁',
      description: '小学入学前免疫规划加强，流脑可选自费 ACYW135 替代',
      planCategory: 'mandatory',
      selectionHint: '免费必打 / 流脑可自费选 ACYW135，乙脑灭活路线补第 4 剂',
      options: [
        {
          id: 'y6-free',
          label: '白破疫苗 + 流脑AC②（免疫规划免费）',
          shortTag: '免费必打',
          fundingType: '免费',
          brandOrigin: '国产',
          brandName: '免疫规划免费苗',
          priceHint: '免费',
          detailNote: '6 岁入学前国家免疫规划免费加强针',
        },
        {
          id: 'y6-acyw135',
          label: '自费 ACYW135流脑（替代免费流脑AC②）',
          shortTag: '四价替代',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产 ACYW135 流脑疫苗',
          priceHint: '约 ¥165.5/剂',
          detailNote: '同时仍需按免疫规划接种免费白破疫苗',
        },
        {
          id: 'y6-je-4',
          label: '乙脑灭活④（仅前期选乙脑灭活路线）',
          shortTag: '乙脑灭活',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '国产乙脑灭活疫苗',
          priceHint: '约 ¥155.5/剂',
          detailNote: '6 岁完成乙脑灭活第 4 剂收官',
        },
      ],
      status: 'locked',
    },

    // ==================== 9 岁（女孩） ====================
    {
      id: 'vac-opt-hpv',
      order: 37,
      name: 'HPV 疫苗（女孩）',
      doseLabel: '适龄首剂',
      recommendedMonth: '9 岁',
      description: '9 岁起适龄女孩预防宫颈癌等 HPV 相关疾病',
      planCategory: 'optional',
      selectionHint: '自费可选 · 九价进口 / 二价国产',
      options: [
        {
          id: 'hpv-9-import',
          label: '九价 HPV 疫苗（进口·默沙东 佳达修9）',
          shortTag: '九价·进口',
          fundingType: '自费',
          brandOrigin: '进口',
          brandName: '默沙东·佳达修9',
          priceHint: '约 ¥1327.5/剂',
          detailNote: '9–14 岁女孩接种 2 剂程序，覆盖 9 种高危/低危型别',
        },
        {
          id: 'hpv-2-domestic',
          label: '二价 HPV 疫苗（国产·馨可宁/沃泽惠）',
          shortTag: '二价·国产',
          fundingType: '自费',
          brandOrigin: '国产',
          brandName: '万泰馨可宁 / 沃森沃泽惠',
          priceHint: '以门诊当季定价为准',
          detailNote: '预防高危 16/18 型（约占 70% 宫颈癌病因），性价比高',
        },
      ],
      status: 'locked',
    },
  ];
}

/**
 * 将本地已保存的旧疫苗记录无缝升级至新版门诊完整疫苗计划：
 * - 完整保留老用户已经勾选的 activated 状态、日期、品牌、费用与备注
 * - 自动补齐新版目录中的免疫规划/非免疫规划分类、可选替代方案、参考价与温馨提示
 * - 若旧目录包含未映射的自定义记录则保留在末尾，绝不丢数据
 */
export function mergeWithClinicVaccineCatalog(
  existing: VaccineDose[],
  todayStr: string = getTodayDateStr()
): VaccineDose[] {
  const catalog = createFullClinicVaccineSchedule(todayStr);
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const catalogIds = new Set(catalog.map((item) => item.id));

  const merged: VaccineDose[] = catalog.map((fresh) => {
    const saved = existingMap.get(fresh.id);
    if (!saved) {
      // 如果旧记录里已经打卡了更多针，新加入的默认项不强制保持 activated（除出生/1月龄初始外）
      return fresh;
    }

    const isActivated = saved.status === 'activated';
    return {
      ...fresh,
      status: saved.status,
      inoculatedDate: isActivated ? saved.inoculatedDate : undefined,
      selectedOptionId: saved.selectedOptionId ?? fresh.selectedOptionId,
      selectedOptionLabel: saved.selectedOptionLabel ?? fresh.selectedOptionLabel,
      brandOrigin: saved.brandOrigin ?? (isActivated ? fresh.brandOrigin : undefined),
      brandName: saved.brandName ?? (isActivated ? fresh.brandName : undefined),
      fundingType: saved.fundingType ?? (isActivated ? fresh.fundingType : undefined),
      pricePaid: saved.pricePaid ?? fresh.pricePaid,
      note: saved.note ?? (isActivated ? fresh.note : undefined),
      updatedAt: saved.updatedAt,
    };
  });

  // 保留用户此前可能已打过但不在新列表 ID 中的旧记录（例如 vac-6 / vac-8 仅当已打卡时保留）
  for (const oldItem of existing) {
    if (!catalogIds.has(oldItem.id) && oldItem.status === 'activated') {
      merged.push({
        ...oldItem,
        planCategory: oldItem.planCategory ?? 'mandatory',
      });
    }
  }

  // 规范化 next 高亮：确保第一个未接种项为 next，其余未接种项为 locked
  const firstPendingIdx = merged.findIndex((v) => v.status !== 'activated');
  return merged.map((v, idx) => {
    if (v.status === 'activated') return { ...v, order: idx + 1 };
    return {
      ...v,
      order: idx + 1,
      status: idx === firstPendingIdx ? 'next' : 'locked',
    };
  });
}
