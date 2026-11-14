import { NativeModules, Platform } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import type { IdCardInfo } from '../../domain/Entities/IdCardInfo';
import type { IOcrRepository } from '../../domain/Repositories/IOcrRepository';

export class OcrUnavailableError extends Error {
  constructor() {
    super(
      'On-device scanning requires an installed Android/iOS development build. You can enter the ID details manually in this form.',
    );
    this.name = 'OcrUnavailableError';
  }
}

const linesFor = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const parseDateOfBirth = (lines: string[]): string => {
  const datePattern = /(^|\D)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/;
  for (const line of lines) {
    const match = datePattern.exec(line);
    if (!match) continue;

    const day = Number(match[2]);
    const month = Number(match[3]);
    const year = Number(match[4]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}/${match[4]}`;
    }
  }
  return '';
};

const parseIdNumber = (lines: string[]): string => {
  const labeledLine = lines.find((line) =>
    /(?:CCCD|CĂN CƯỚC|SỐ ĐỊNH DANH|MSSV|MÃ SV|SỐ SV|STUDENT\s*(?:ID|NO|NUMBER|CODE))\b/i.test(
      line,
    ),
  );
  if (labeledLine) {
    const labeledValue = labeledLine.match(
      /(?:CCCD|CĂN CƯỚC|SỐ ĐỊNH DANH|MSSV|MÃ SV|SỐ SV|STUDENT\s*(?:ID|NO|NUMBER|CODE))\D{0,12}([A-Z0-9][A-Z0-9 -]{5,15})/i,
    )?.[1];
    if (labeledValue) {
      const normalized = labeledValue.replace(/[\s-]/g, '').toUpperCase();
      if (normalized.length >= 6 && normalized.length <= 16) return normalized;
    }
  }

  for (const line of lines) {
    const match = /(?:^|\D)(\d{12})(?!\d)/.exec(line);
    if (match) return match[1];
  }
  for (const line of lines) {
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(line)) continue;
    const match =
      /(?:^|[^A-Z0-9])([A-Z]{1,4}[- ]?\d[A-Z0-9-]{5,14}|\d{8,11})(?![A-Z0-9])/i.exec(
        line,
      );
    if (match) return match[1].replace(/[\s-]/g, '').toUpperCase();
  }
  return '';
};

const excludedNameLine =
  /\b(?:CCCD|MSSV|STUDENT|UNIVERSITY|FACULTY|KHOA|NGÀNH|LỚP|CLASS|DATE|BIRTH|QUỐC|TỊCH|VIỆT NAM|CỘNG HÒA|ĐỘC LẬP|HẠNH PHÚC|CĂN CƯỚC|SỐ ĐỊNH DANH)\b/i;

const parseFullName = (lines: string[]): string => {
  const nameLabel = /(?:HỌ\s*(?:VÀ|&)\s*TÊN|HỌ TÊN|FULL\s*NAME|NAME)\s*[:\-]?\s*(.*)/i;
  for (let index = 0; index < lines.length; index += 1) {
    const match = nameLabel.exec(lines[index]);
    if (!match) continue;
    const value = match[1].trim() || lines[index + 1] || '';
    if (isLikelyName(value)) return value.toUpperCase();
  }

  return (
    lines.find((line) => isLikelyName(line) && !excludedNameLine.test(line))
      ?.toUpperCase() ?? ''
  );
};

const isLikelyName = (line: string): boolean => {
  const normalized = line.trim();
  const words = normalized.split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    /^[A-ZÀ-ỸĐ][A-ZÀ-ỸĐ'.-]*(?:\s+[A-ZÀ-ỸĐ][A-ZÀ-ỸĐ'.-]*){1,4}$/i.test(
      normalized,
    ) &&
    !/\d/.test(normalized)
  );
};

const parseLabeledValue = (lines: string[], pattern: RegExp): string => {
  for (let index = 0; index < lines.length; index += 1) {
    const match = pattern.exec(lines[index]);
    if (!match) continue;
    const value = match[1].trim() || lines[index + 1] || '';
    if (value && !/^\d/.test(value)) return value;
  }
  return '';
};

const parseIdCardInfo = (text: string): IdCardInfo => {
  const lines = linesFor(text);
  return {
    idNumber: parseIdNumber(lines),
    fullName: parseFullName(lines),
    dateOfBirth: parseDateOfBirth(lines),
    major: parseLabeledValue(
      lines,
      /(?:KHOA|NGÀNH|CHUYÊN NGÀNH|FACULTY|MAJOR)\s*[:\-]?\s*(.*)/i,
    ),
    subInfo: parseLabeledValue(
      lines,
      /(?:LỚP|CLASS|CHUYÊN NGÀNH|SUBINFO)\s*[:\-]?\s*(.*)/i,
    ),
  };
};

export class MlKitOcrRepositoryImpl implements IOcrRepository {
  async extractIdCard(imageUri: string): Promise<IdCardInfo> {
    if (Platform.OS === 'web' || !NativeModules.TextRecognition) {
      throw new OcrUnavailableError();
    }

    const result = await TextRecognition.recognize(imageUri);
    const info = parseIdCardInfo(result.text);
    if (!info.idNumber && !info.fullName && !info.dateOfBirth && !info.major) {
      throw new Error(
        'No identity details could be read. Try a clearer, well-lit image or enter the details manually.',
      );
    }
    return info;
  }
}
