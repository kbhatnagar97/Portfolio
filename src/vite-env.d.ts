/// <reference types="vite/client" />

declare module 'virtual:automation-cards' {
  const cards: import('./site/data').IAutomationCard[];
  export default cards;
}

declare module 'virtual:case-cards' {
  const cards: import('./cases/build/types').ICaseCard[];
  export default cards;
}
