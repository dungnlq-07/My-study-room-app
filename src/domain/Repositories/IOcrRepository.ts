import type { IdCardInfo } from '../Entities/IdCardInfo';

export interface IOcrRepository {
  extractIdCard(imageUri: string): Promise<IdCardInfo>;
}
