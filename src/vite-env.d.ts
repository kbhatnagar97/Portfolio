/// <reference types="vite/client" />

declare module 'virtual:automation-cards' {
  const cards: import('./site/data').IAutomationCard[];
  export default cards;
}
