const ONES_M = [
  "", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять",
  "десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять",
  "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять",
];
const ONES_F = [
  "", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять",
  "десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять",
  "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять",
];
const TENS = [
  "", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят",
  "вісімдесят", "дев'яносто",
];
const HUNDREDS = [
  "", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот",
  "вісімсот", "дев'ятсот",
];

function triplet(n, feminine) {
  const ones = feminine ? ONES_F : ONES_M;
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest < 20) {
    if (rest) parts.push(ones[rest]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ones[o]);
  }
  return parts.join(" ");
}

function pluralForm(n, forms) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

const THOUSAND_FORMS = ["тисяча", "тисячі", "тисяч"];
const HRYVNIA_FORMS = ["гривня", "гривні", "гривень"];
const KOPIYKA_FORMS = ["копійка", "копійки", "копійок"];

function integerToWords(num) {
  if (num === 0) return "нуль";
  const million = Math.floor(num / 1_000_000);
  const thousand = Math.floor((num % 1_000_000) / 1000);
  const rest = num % 1000;
  const parts = [];
  if (million) {
    parts.push(triplet(million, false));
    parts.push(pluralForm(million, ["мільйон", "мільйони", "мільйонів"]));
  }
  if (thousand) {
    parts.push(triplet(thousand, true));
    parts.push(pluralForm(thousand, THOUSAND_FORMS));
  }
  if (rest || parts.length === 0) {
    parts.push(triplet(rest, false));
  }
  return parts.filter(Boolean).join(" ");
}

export function amountToWordsUA(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  const hryvni = Math.floor(value);
  const kopiyky = Math.round((value - hryvni) * 100);
  const hryvniWords = `${integerToWords(hryvni)} ${pluralForm(hryvni, HRYVNIA_FORMS)}`;
  const kopiykyWords = `${String(kopiyky).padStart(2, "0")} ${pluralForm(kopiyky, KOPIYKA_FORMS)}`;
  const sentence = `${hryvniWords} ${kopiykyWords}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
