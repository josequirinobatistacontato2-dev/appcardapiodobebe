
export enum ReleaseType {
  IMMEDIATE = 'IMMEDIATE',
  SCHEDULED = 'SCHEDULED', 
  CONDITIONAL = 'CONDITIONAL' 
}

export enum Category {
  ALIMENTACAO = 'Alimentação Saudável',
  SUCOS = 'Sucos Naturais & Detox',
  SAUDE = 'Saúde & Bem-estar'
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  email: string;
  event: string;
  status: 'success' | 'error';
  message: string;
}

export interface PromotionBanner {
  id: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  active: boolean;
  order: number;
  productId?: string; // Opcional: vincular a um produto para herdar status de bloqueio
  isLocked?: boolean;  // Opcional: forçar bloqueio manual do banner
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  active: boolean;
  type?: 'info' | 'promotion' | 'alert';
}

export interface ThemeSettings {
  // Área de Membros (Aluno)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  sidebarColor: string;
  headerColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  
  // Cores de Texto Específicas
  welcomeTextColor: string;
  headerTitleColor: string;
  headerSubtitleColor?: string;
  dashboardTitleColor: string;

  // Painel Master (Admin)
  adminPrimaryColor: string;
  adminSecondaryColor: string;
  adminBackgroundColor: string;
  adminSidebarColor: string;
  adminHeaderColor: string;
  adminTextColor: string;
  adminButtonColor: string;
  adminButtonTextColor: string;

  // Configurações Gerais e Branding
  faviconUrl: string;
  bannerGradientStart: string;
  bannerGradientEnd: string;
  logoType: 'text' | 'image';
  logoImageUrl: string;
  logoTextTop: string;
  logoTextBottom: string;
  loginTagline: string;
  loginSubTagline: string;
  loginBannerUrl: string; 
  loginMobileImageUrl: string;
  loginCardBackgroundUrl: string; 
  externalSiteUrl: string;
  adminEmail: string; 
  hotmartToken: string;

  // Configurações de Suporte
  supportWhatsappActive: boolean;
  supportWhatsappNumber: string;
  supportWhatsappMessage: string;

  // Banner da Área do Aluno (Simples - Mantido por retrocompatibilidade)
  studentBannerActive: boolean;
  studentBannerDesktopUrl: string;
  studentBannerMobileUrl: string;
  studentBannerTitle: string;
  studentBannerSubtitle: string;
  studentBannerLink: string;

  // Categorias Dinâmicas
  customCategories?: string[];

  // Configurações de Banner
  bannerSpeed?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  category: string;
  displayCategory?: string; // Novo campo para agrupamento visual
  pdfUrl: string;
  releaseType: ReleaseType;
  releaseDays?: number;
  active: boolean;
  forceLocked?: boolean;
  
  isBonus?: boolean;       
  parentId?: string;      
  hotmartId?: string;     
  checkoutUrl?: string;   
}

export type AccessDuration = '7days' | '30days' | '1year' | 'lifetime';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string; // Campo para a foto de perfil
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  accessType: AccessDuration;
  startDate: string; 
  expiryDate?: string; 
  resetToken?: string;
  resetTokenExpiry?: number;
  purchasedProducts: {
    productId: string;
    purchaseDate: string; 
  }[];
}

export type HotmartEvent = 'PURCHASE_APPROVED' | 'PURCHASE_CANCELED' | 'PURCHASE_REFUNDED' | 'PURCHASE_CHARGEBACK';

export interface HotmartWebhookPayload {
  hproc: string; 
  event: HotmartEvent;
  buyer: {
    name: string;
    email: string;
  };
  product: {
    id: string;
    name: string;
  };
  purchase: {
    transaction: string;
    date: string;
  };
}
