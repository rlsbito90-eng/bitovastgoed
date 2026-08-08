/**
 * Omgevingsneutrale runtimegrens voor Productiekern-reads.
 *
 * Productie en een afzonderlijke duurzame werk-CRM mogen elk hun eigen
 * bewijspoort hanteren. De read-only repositories hoeven uitsluitend te weten
 * of lezen daadwerkelijk is vrijgegeven en welk bewijs eventueel ontbreekt.
 */
export interface ProductiekernLeesActivatieBesluit {
  lezenActief: boolean;
  ontbrekendBewijs: string[];
}
