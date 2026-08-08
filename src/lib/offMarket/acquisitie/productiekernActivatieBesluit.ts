/**
 * Omgevingsneutrale runtimegrens voor de Acquisitieproductiekern.
 *
 * Zowel productie als een afzonderlijke duurzame werk-CRM leveren exact deze
 * beslisvorm op. De omgevingsspecifieke poorten blijven verantwoordelijk voor
 * hun eigen bewijs; repositories en UI hoeven alleen te weten of lezen en
 * schrijven daadwerkelijk zijn vrijgegeven.
 */
export interface ProductiekernActivatieBesluit {
  lezenActief: boolean;
  schrijvenActief: boolean;
  ontbrekendBewijs: string[];
}
