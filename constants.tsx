
import { Category, Product, ReleaseType, ThemeSettings, PromotionBanner, Notice } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Cardápio do Bebê Saudável – 80 Receitas',
    description: 'O passo a passo para as primeiras papinhas do seu bebê com segurança.',
    coverImage: 'https://picsum.photos/seed/baby1/600/800',
    category: Category.ALIMENTACAO,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    releaseType: ReleaseType.IMMEDIATE,
    active: true
  },
  {
    id: 'prod-2',
    name: 'Guia de Introdução Alimentar',
    description: 'Tudo o que você precisa saber para começar a introdução alimentar.',
    coverImage: 'https://picsum.photos/seed/baby2/600/800',
    category: Category.ALIMENTACAO,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    releaseType: ReleaseType.IMMEDIATE,
    active: true
  },
  {
    id: 'prod-3',
    name: 'Papinhas Salgadas e Doces',
    description: 'Receitas variadas para todas as fases do crescimento.',
    coverImage: 'https://picsum.photos/seed/baby3/600/800',
    category: Category.ALIMENTACAO,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    releaseType: ReleaseType.IMMEDIATE,
    active: true
  },
  {
    id: 'prod-4',
    name: 'Manual do Sono do Bebê',
    description: 'Dicas práticas para noites mais tranquilas.',
    coverImage: 'https://picsum.photos/seed/baby4/600/800',
    category: Category.SAUDE,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    releaseType: ReleaseType.SCHEDULED,
    releaseDays: 7,
    active: true
  }
];

export const INITIAL_BANNERS: PromotionBanner[] = [
  {
    id: 'banner-initial-1',
    desktopImageUrl: 'https://picsum.photos/seed/babyfood1/1920/640',
    mobileImageUrl: 'https://picsum.photos/seed/babyfood1m/800/400',
    title: 'NUTRIÇÃO QUE TRANSFORMA',
    subtitle: 'Descubra o poder da alimentação natural para seu bebê.',
    linkUrl: 'https://www.appcardapiodobebe.com/guia',
    active: true,
    order: 1
  },
  {
    id: 'banner-initial-2',
    desktopImageUrl: 'https://picsum.photos/seed/babyfood2/1920/640',
    mobileImageUrl: 'https://picsum.photos/seed/babyfood2m/800/400',
    title: 'RECEITAS EXCLUSIVAS',
    subtitle: 'Novos cardápios detox para pais e bebês.',
    linkUrl: 'https://pay.hotmart.com/example',
    active: true,
    order: 2,
    isLocked: true // Demonstrando o bloqueio com cadeado
  },
  {
    id: 'banner-initial-3',
    desktopImageUrl: 'https://picsum.photos/seed/babyfood3/1920/640',
    mobileImageUrl: 'https://picsum.photos/seed/babyfood3m/800/400',
    title: 'CONTEÚDO VIP',
    subtitle: 'Acesse nossa comunidade exclusiva de alunos(as).',
    linkUrl: 'https://wa.me/example',
    active: true,
    order: 3
  }
];

export const INITIAL_NOTICES: Notice[] = [
  {
    id: 'notice-1',
    title: 'Bem-vinda ao Portal!',
    content: 'Estamos muito felizes em ter você aqui. Explore nossos cardápios e prepare receitas incríveis para o seu pequeno.',
    createdAt: new Date().toISOString(),
    active: true,
    type: 'info'
  },
  {
    id: 'notice-2',
    title: 'Nova Comunidade no WhatsApp',
    content: 'Já faz parte do nosso grupo exclusivo de alunos(as)? Clique no banner superior para entrar!',
    createdAt: new Date().toISOString(),
    active: true,
    type: 'promotion'
  }
];

export const DEFAULT_THEME: ThemeSettings = {
  // Área de Membros (Aluno)
  primaryColor: '#FF7A00',
  secondaryColor: '#004A8D',
  accentColor: '#5BA525',
  backgroundColor: '#fdfbf7',
  sidebarColor: '#ffffff',
  headerColor: '#ffffff',
  textColor: '#1c1917',
  buttonColor: '#FF7A00',
  buttonTextColor: '#ffffff',
  
  // Padrões para novas cores
  welcomeTextColor: '#d6d3d1',
  headerTitleColor: '#004A8D',
  headerSubtitleColor: '#004A8D',
  dashboardTitleColor: '#1c1917',

  // Painel Master (Admin)
  adminPrimaryColor: '#004A8D',
  adminSecondaryColor: '#ffffff',
  adminBackgroundColor: '#f4f4f5',
  adminSidebarColor: '#ffffff',
  adminHeaderColor: '#ffffff',
  adminTextColor: '#1c1917',
  adminButtonColor: '#004A8D',
  adminButtonTextColor: '#ffffff',

  faviconUrl: '',
  bannerGradientStart: '#FF7A00',
  bannerGradientEnd: '#FF8A00',
  logoType: 'text',
  logoImageUrl: '',
  logoTextTop: 'Cardápio do',
  logoTextBottom: 'Bebê',
  loginTagline: 'NUTRIÇÃO QUE TRANSFORMA VIDAS',
  loginSubTagline: 'O guia definitivo para pais que buscam o melhor para seus filhos.',
  loginBannerUrl: 'https://picsum.photos/seed/loginbg/1920/1080',
  loginMobileImageUrl: '',
  loginCardBackgroundUrl: '',
  externalSiteUrl: 'https://www.appcardapiodobebe.com',
  adminEmail: 'sertanejopremiercontato@gmail.com',
  hotmartToken: '',

  // Suporte WhatsApp
  supportWhatsappActive: true,
  supportWhatsappNumber: '5500000000000',
  supportWhatsappMessage: 'Olá, preciso de ajuda com meu acesso no app Cardápio do Bebê Saudável.',

  // Banner da Área do Aluno
  studentBannerActive: false,
  studentBannerDesktopUrl: '',
  studentBannerMobileUrl: '',
  studentBannerTitle: '',
  studentBannerSubtitle: '',
  studentBannerLink: '',

  // Categorias Dinâmicas
  customCategories: [
    Category.ALIMENTACAO,
    Category.SUCOS,
    Category.SAUDE
  ],
  bannerSpeed: 5000
};
