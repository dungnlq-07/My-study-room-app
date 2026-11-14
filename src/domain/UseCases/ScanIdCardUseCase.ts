import type { IdCardInfo } from '../Entities/IdCardInfo';
import type { IOcrRepository } from '../Repositories/IOcrRepository';

export class ScanIdCardUseCase {
  constructor(private readonly ocrRepository: IOcrRepository) {}

  execute(imageUri: string): Promise<IdCardInfo> {
    if (!imageUri.trim()) {
      return Promise.reject(new Error('An image is required to scan an ID card.'));
    }
    return this.ocrRepository.extractIdCard(imageUri);
  }
}
