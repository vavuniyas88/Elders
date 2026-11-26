import type { Timestamp } from 'firebase/firestore';
import type {
  CitizenCategoryTab,
  ElderlyCitizen,
  GnDivision,
  GnDivisionStat,
  PublicStatsSummary,
} from '../types';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'vavuniyas88@gmail.com';
export const INTERNAL_STAFF_EMAIL_DOMAIN = 'manthaiwest.gov.lk';

export function resolveLoginIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const cleanUsername = trimmed.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${cleanUsername}@${INTERNAL_STAFF_EMAIL_DOMAIN}`;
}

export function normalizeNic(nic: string): string {
  return nic.trim().toUpperCase();
}

export function isValidSriLankanNic(nic: string): boolean {
  const normalized = normalizeNic(nic);
  return /^([0-9]{9}[VX]|[0-9]{12})$/.test(normalized);
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()+]/g, '');
  return digits.length >= 9 && digits.length <= 15 && /^[0-9]+$/.test(digits);
}

export function getLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Automatically calculates completed years from Date of Birth against referenceDate (today).
 */
export function calculateAge(
  dateOfBirth: string,
  referenceDate: Date = new Date()
): number {
  if (!dateOfBirth || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOfBirth)) {
    return 0;
  }
  const [yStr, mStr, dStr] = dateOfBirth.split('-');
  const birthYear = Number(yStr);
  const birthMonth = Number(mStr);
  const birthDay = Number(dStr);

  if (
    Number.isNaN(birthYear) ||
    Number.isNaN(birthMonth) ||
    Number.isNaN(birthDay)
  ) {
    return 0;
  }

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const refDay = referenceDate.getDate();

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function getAgeGroupLabel(age: number): 'Under 60' | '60+' | '70+' {
  if (age >= 70) return '70+';
  if (age >= 60) return '60+';
  return 'Under 60';
}

export function toDateValue(
  ts: Timestamp | Date | string | undefined | null
): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  return null;
}

export function formatTimestamp(
  ts: Timestamp | Date | string | undefined | null,
  includeTime = true
): string {
  const date = toDateValue(ts);
  if (!date) return '—';
  return includeTime
    ? date.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
}

export function filterCitizensByCategory(
  citizens: ElderlyCitizen[],
  category: CitizenCategoryTab,
  referenceDate: Date = new Date()
): ElderlyCitizen[] {
  return citizens.filter((c) => {
    const age = calculateAge(c.dateOfBirth, referenceDate);
    switch (category) {
      case 'all_60_plus':
        return age >= 60;
      case 'aged_60_69':
        return age >= 60 && age <= 69;
      case 'aged_70_plus':
        return age >= 70;
      case 'allowance_recipients':
        return age >= 70 && c.receivingAllowance;
      case 'bank_recipients':
        return c.receivingAllowance && c.paymentMethod === 'Bank';
      case 'post_office_recipients':
        return c.receivingAllowance && c.paymentMethod === 'Post Office';
      case 'non_allowance_70_plus':
        return age >= 70 && !c.receivingAllowance;
      default:
        return true;
    }
  });
}

export function computePublicStats(
  citizens: ElderlyCitizen[],
  divisions: GnDivision[],
  referenceDate: Date = new Date()
): Omit<PublicStatsSummary, 'updatedAt'> {
  let aged60Plus = 0;
  let aged60To69 = 0;
  let aged70Plus = 0;
  let receivingAllowance = 0;
  let notReceivingAllowance = 0;
  let bankRecipients = 0;
  let postOfficeRecipients = 0;
  let maleCount = 0;
  let femaleCount = 0;

  const allowanceStatusCounts = {
    Active: 0,
    Suspended: 0,
    Pending: 0,
    Other: 0,
    'Not Applicable': 0,
  };

  const divisionMap = new Map<string, GnDivisionStat>();
  for (const div of divisions) {
    divisionMap.set(div.id, {
      divisionId: div.id,
      code: div.code,
      divisionNameEn: div.nameEn,
      divisionNameTa: div.nameTa,
      total: 0,
      aged60To69: 0,
      aged70Plus: 0,
      receivingAllowance: 0,
      notReceivingAllowance: 0,
      bankRecipients: 0,
      postOfficeRecipients: 0,
    });
  }

  for (const c of citizens) {
    const age = calculateAge(c.dateOfBirth, referenceDate);
    if (age >= 60) aged60Plus += 1;
    if (age >= 60 && age <= 69) aged60To69 += 1;
    if (age >= 70) aged70Plus += 1;

    if (c.receivingAllowance) {
      receivingAllowance += 1;
      if (c.paymentMethod === 'Bank') bankRecipients += 1;
      if (c.paymentMethod === 'Post Office') postOfficeRecipients += 1;
    } else {
      notReceivingAllowance += 1;
    }

    if (c.gender === 'Male') maleCount += 1;
    else if (c.gender === 'Female') femaleCount += 1;

    if (c.allowanceStatus in allowanceStatusCounts) {
      allowanceStatusCounts[c.allowanceStatus] += 1;
    }

    let divStat = divisionMap.get(c.gnDivisionId);
    if (!divStat) {
      divStat = {
        divisionId: c.gnDivisionId,
        code: 'GN',
        divisionNameEn: c.gnDivisionName,
        divisionNameTa: c.gnDivisionName,
        total: 0,
        aged60To69: 0,
        aged70Plus: 0,
        receivingAllowance: 0,
        notReceivingAllowance: 0,
        bankRecipients: 0,
        postOfficeRecipients: 0,
      };
      divisionMap.set(c.gnDivisionId, divStat);
    }

    divStat.total += 1;
    if (age >= 60 && age <= 69) divStat.aged60To69 += 1;
    if (age >= 70) divStat.aged70Plus += 1;
    if (c.receivingAllowance) {
      divStat.receivingAllowance += 1;
      if (c.paymentMethod === 'Bank') divStat.bankRecipients += 1;
      if (c.paymentMethod === 'Post Office') divStat.postOfficeRecipients += 1;
    } else {
      divStat.notReceivingAllowance += 1;
    }
  }

  const gnDivisionStats = Array.from(divisionMap.values()).sort((a, b) =>
    a.divisionNameEn.localeCompare(b.divisionNameEn)
  );

  return {
    totalRegistered: citizens.length,
    aged60Plus,
    aged60To69,
    aged70Plus,
    receivingAllowance,
    notReceivingAllowance,
    bankRecipients,
    postOfficeRecipients,
    maleCount,
    femaleCount,
    allowanceStatusCounts,
    gnDivisionStats,
    statsDate: getLocalIsoDate(referenceDate),
  };
}

export const OFFICIAL_MANTHAI_WEST_DIVISIONS: Array<{
  id: string;
  code: string;
  nameEn: string;
  nameTa: string;
  gnOfficerName: string;
  gnOfficerPhone: string;
}> = [
  { id: 'gn_mn_01', code: 'MN/01', nameEn: 'Vellankulam', nameTa: 'வெள்ளாங்குளம்', gnOfficerName: 'Mrs. P. Jehapriya', gnOfficerPhone: '0771550507' },
  { id: 'gn_mn_02', code: 'MN/02', nameEn: 'Thevanpity', nameTa: 'தேவன்பிட்டி', gnOfficerName: 'Mrs. P. Jehapriya', gnOfficerPhone: '0771550507' },
  { id: 'gn_mn_03', code: 'MN/03', nameEn: 'Paliyaru', nameTa: 'பாலியாறு', gnOfficerName: 'Mr. N. Gnakkumar', gnOfficerPhone: '0770699152' },
  { id: 'gn_mn_04', code: 'MN/04', nameEn: 'Ilupaikkadavai', nameTa: 'இலுப்பைக்கடவை', gnOfficerName: 'Mr. M. Vickneswaran', gnOfficerPhone: '0766087122' },
  { id: 'gn_mn_05', code: 'MN/05', nameEn: 'Anthoniyapuram', nameTa: 'அந்தோனியாபுரம்', gnOfficerName: 'Mr. S. Jehavinotharan', gnOfficerPhone: '0740477021' },
  { id: 'gn_mn_06', code: 'MN/06', nameEn: 'Kalliyadi', nameTa: 'கள்ளியடி', gnOfficerName: 'Mr. M. P. Ponkalan', gnOfficerPhone: '0775714090' },
  { id: 'gn_mn_07', code: 'MN/07', nameEn: 'Koorai', nameTa: 'கூராய்', gnOfficerName: 'Mrs. K. Asemta', gnOfficerPhone: '0775918630' },
  { id: 'gn_mn_08', code: 'MN/08', nameEn: 'Aththimodai', nameTa: 'ஆத்திமோட்டை', gnOfficerName: 'Mr. M. Vickneswaran', gnOfficerPhone: '0766087122' },
  { id: 'gn_mn_09', code: 'MN/09', nameEn: 'Kovilkulam', nameTa: 'கோவில்குளம்', gnOfficerName: 'Mrs. K. Asemta', gnOfficerPhone: '0775918630' },
  { id: 'gn_mn_10', code: 'MN/10', nameEn: 'Vidaththaltivu West', nameTa: 'விடத்தல்தீவு மேற்கு', gnOfficerName: 'Mr. A. A. Aswathkan', gnOfficerPhone: '0777111745' },
  { id: 'gn_mn_11', code: 'MN/11', nameEn: 'Vidaththaltivu North', nameTa: 'விடத்தல்தீவு வடக்கு', gnOfficerName: 'Mr. A. A. Aswathkan', gnOfficerPhone: '0777111745' },
  { id: 'gn_mn_12', code: 'MN/12', nameEn: 'Vidaththaltivu Center', nameTa: 'விடத்தல்தீவு மத்தி', gnOfficerName: 'Mrs. J. B. L. Juditta', gnOfficerPhone: '0779831335' },
  { id: 'gn_mn_13', code: 'MN/13', nameEn: 'Vidaththaltivu East', nameTa: 'விடத்தல்தீவு கிழக்கு', gnOfficerName: 'Mrs. A. Emarensiya', gnOfficerPhone: '0763566523' },
  { id: 'gn_mn_14', code: 'MN/14', nameEn: 'Pallamadu', nameTa: 'பள்ளமடு', gnOfficerName: 'Mr. T. Sivanesan', gnOfficerPhone: '0776283288' },
  { id: 'gn_mn_15', code: 'MN/15', nameEn: 'Kayanagar', nameTa: 'காயாநகர்', gnOfficerName: 'Mr. T. M. Saheen', gnOfficerPhone: '0740233382' },
  { id: 'gn_mn_16', code: 'MN/16', nameEn: 'Periyamadu West', nameTa: 'பெரியமடு மேற்கு', gnOfficerName: 'Mr. S. Jeevarasa', gnOfficerPhone: '0775716655' },
  { id: 'gn_mn_17', code: 'MN/17', nameEn: 'Periyamadu East', nameTa: 'பெரியமடு கிழக்கு', gnOfficerName: 'Mr. M. A. C. Umais', gnOfficerPhone: '0750382859' },
  { id: 'gn_mn_18', code: 'MN/18', nameEn: 'Pappamottai', nameTa: 'பாப்பாமோட்டை', gnOfficerName: 'Mr. J. Antony', gnOfficerPhone: '0770743199' },
  { id: 'gn_mn_19', code: 'MN/19', nameEn: 'Veddayamurippu', nameTa: 'வேடடையார்முறிப்பு', gnOfficerName: 'Mrs. P. Valanteena', gnOfficerPhone: '0778320512' },
  { id: 'gn_mn_20', code: 'MN/20', nameEn: 'Minukkan', nameTa: 'மினுக்கன்', gnOfficerName: 'Mr. S. Sriskantharajah', gnOfficerPhone: '0771430312' },
  { id: 'gn_mn_21', code: 'MN/21', nameEn: 'Maligaithidal', nameTa: 'மாளிகைத்திடல்', gnOfficerName: 'Mrs. S. Linat Arulmathy', gnOfficerPhone: '0773635989' },
  { id: 'gn_mn_22', code: 'MN/22', nameEn: 'Adampan', nameTa: 'அடம்பன்', gnOfficerName: 'Mr. S. Pirashath', gnOfficerPhone: '0779622197' },
  { id: 'gn_mn_23', code: 'MN/23', nameEn: 'Palaikuly', nameTa: 'பாலைக்குளி', gnOfficerName: 'Mr. P. Santhiyogu', gnOfficerPhone: '0770473750' },
  { id: 'gn_mn_24', code: 'MN/24', nameEn: 'Nedunkandal', nameTa: 'நெடுங்கண்டல்', gnOfficerName: 'Mr. S. Sriskantharajah', gnOfficerPhone: '0771430312' },
  { id: 'gn_mn_25', code: 'MN/25', nameEn: 'Sornapuri', nameTa: 'சொர்ணபுரி', gnOfficerName: 'Mrs. D. Juditta', gnOfficerPhone: '0778140364' },
  { id: 'gn_mn_26', code: 'MN/26', nameEn: 'Karunkandal', nameTa: 'கருங்கண்டல்', gnOfficerName: 'Mrs. L. Kuloja', gnOfficerPhone: '0766079823' },
  { id: 'gn_mn_27', code: 'MN/27', nameEn: 'Andankulam', nameTa: 'ஆண்டாங்குளம்', gnOfficerName: 'Mr. P. Kathirkamanathan', gnOfficerPhone: '0775252638' },
  { id: 'gn_mn_28', code: 'MN/28', nameEn: 'Kannady', nameTa: 'கன்னாட்டி', gnOfficerName: 'Mrs. J. Mary Anatta', gnOfficerPhone: '0774729987' },
  { id: 'gn_mn_29', code: 'MN/29', nameEn: 'Alkattively', nameTa: 'ஆட்காட்டிவெளி', gnOfficerName: 'Mr. G. Krisanraj', gnOfficerPhone: '0774571498' },
  { id: 'gn_mn_30', code: 'MN/30', nameEn: 'Vannankulam', nameTa: 'வண்ணாங்குளம்', gnOfficerName: 'Mrs. J. Jeevasugarniya', gnOfficerPhone: '0776946011' },
  { id: 'gn_mn_31', code: 'MN/31', nameEn: 'Kathankulam', nameTa: 'காத்தாங்குளம்', gnOfficerName: 'Mr. A. Loganathan', gnOfficerPhone: '0770517080' },
  { id: 'gn_mn_32', code: 'MN/32', nameEn: 'Vaddakandal', nameTa: 'வட்டக்கண்டல்', gnOfficerName: 'Mrs. R. Qeency Stella', gnOfficerPhone: '0775658459' },
  { id: 'gn_mn_33', code: 'MN/33', nameEn: 'Palaiperumalkaddu', nameTa: 'பாலைப்பெருமாள்கட்டு', gnOfficerName: 'Mr. S. Lumasri', gnOfficerPhone: '0779447665' },
  { id: 'gn_mn_34', code: 'MN/34', nameEn: 'Palayadiputhukulam', nameTa: 'பாலையடிபுதுக்குளம்', gnOfficerName: 'Mr. S. S. Stanlis', gnOfficerPhone: '0770326547' },
  { id: 'gn_mn_35', code: 'MN/35', nameEn: 'Parapukadanthan West', nameTa: 'பரப்புக்கடந்தான் மேற்கு', gnOfficerName: 'Mr. S. Jeevarasa', gnOfficerPhone: '0775716655' },
  { id: 'gn_mn_36', code: 'MN/36', nameEn: 'Parapukadanthan East', nameTa: 'பரப்புக்கடந்தான் கிழக்கு', gnOfficerName: 'Mr. P. Santhiyogu', gnOfficerPhone: '0770473750' },
];
