import React, { useState, createContext, useContext, useRef, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, 
  Lock, 
  ChevronRight,
  Trash2,
  Edit,
  X,
  Loader2,
  ChevronLeft,
  Check,
  ArrowLeft,
  LogOut,
  Mail,
  Key,
  Clock,
  Eye,
  EyeOff,
  Sparkles,
  Camera,
  Monitor,
  Smartphone,
  Zap,
  Activity,
  ShieldCheck,
  ShoppingBag,
  Bell,
  BellDot,
  MessageCircle,
  AlertCircle,
  BellOff,
  Settings,
  Palette,
  Layout as LayoutIcon,
  Unlock,
  Gift,
  ExternalLink,
  ToggleRight,
  ToggleLeft,
  ImageIcon,
  Info,
  Save,
  User as UserIcon,
  Search,
  Shield,
  ZapOff,
  Paintbrush,
  Layers,
  HelpCircle,
  SmartphoneIcon
} from 'lucide-react';
import { Product, User, Category, ThemeSettings, ReleaseType, WebhookLog, PromotionBanner, Notice, HotmartWebhookPayload } from './types';
import { INITIAL_PRODUCTS, INITIAL_BANNERS, INITIAL_NOTICES, DEFAULT_THEME } from './constants';

// ==========================================
// CONFIGURAÇÕES E SETUP SUPABASE
// ==========================================

GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zisijswmqoxtfxlgjwgr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6KFWYlCjjniOKdAhfJDMJA_eJT88ZFE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getReleaseStatus = (product: Product, purchaseDate?: string) => {
  if (!purchaseDate) return { isReleased: false, isLocked: true, message: 'BLOQUEADO', sub: 'TOQUE PARA ADQUIRIR', icon: <Lock size={18} /> };
  const now = new Date();
  const pDate = new Date(purchaseDate);
  if (product.releaseType === ReleaseType.IMMEDIATE) return { isReleased: true, isLocked: false, message: 'LIBERADO', sub: 'Pronto para leitura', icon: <Check size={18} /> };
  if (product.releaseType === ReleaseType.SCHEDULED) {
    const days = product.releaseDays || 7;
    const releaseDateObj = new Date(pDate.getTime() + (days * 86400000));
    if (now >= releaseDateObj) return { isReleased: true, isLocked: false, message: 'LIBERADO', sub: 'Bons estudos!', icon: <Check size={18} /> };
    const diffDays = Math.ceil((releaseDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { isReleased: false, isLocked: false, message: `EM ${diffDays} DIAS`, sub: `Prepare o coração!`, icon: <Clock size={18} /> };
  }
  return { isReleased: true, isLocked: false, message: 'LIBERADO', sub: '', icon: <Check size={18} /> };
};

const calculateExpiryDate = (startDate: string, accessType: string): string | undefined => {
  if (accessType === 'lifetime') return undefined;
  const start = new Date(startDate);
  let days = 0;
  if (accessType === '7days') days = 7;
  else if (accessType === '30days') days = 30;
  else if (accessType === '1year') days = 365;
  
  if (days === 0) return undefined;
  return new Date(start.getTime() + (days * 86400000)).toISOString();
};

const isAccessExpired = (user: User | null): boolean => {
  if (!user || user.role === 'admin' || user.accessType === 'lifetime') return false;
  if (!user.expiryDate) return false;
  return new Date() > new Date(user.expiryDate);
};

interface Toast { message: string; type: 'success' | 'error'; id: number; }

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  products: Product[];
  saveProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  clients: User[];
  saveClient: (c: User) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  notices: Notice[];
  saveNotice: (n: Notice) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  banners: PromotionBanner[];
  saveBanners: (b: PromotionBanner[]) => Promise<void>;
  theme: ThemeSettings;
  setTheme: () => Promise<void>;
  setThemeState: React.Dispatch<React.SetStateAction<ThemeSettings>>;
  allCategories: string[];
  webhookLogs: WebhookLog[];
  addLog: (log: Omit<WebhookLog, 'id' | 'timestamp'>) => Promise<void>;
  logout: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  loading: boolean;
  notify: (message: string, type: 'success' | 'error') => void;
  refreshData: () => Promise<void>;
  seedTestData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  checkDatabase: () => Promise<Record<string, boolean>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider');
  return context;
};

// ==========================================
// MÓDULO: ÁREA DE MEMBROS (ALUNO) - AUTH/DASH
// ==========================================

const LoginView = () => {
  const { setUser, clients, theme, notify, refreshData, saveClient, signIn, signUp } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'first-access' | 'forgot-password'>('email');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pass: string) => {
    if (pass.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    return '';
  };

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await refreshData();
    const eTrim = email.trim().toLowerCase();
    
    if (eTrim === theme.adminEmail.toLowerCase()) {
      setStep('password');
      setLoading(false);
      return;
    }

    const client = clients.find(c => c.email.toLowerCase() === eTrim);
    if (client) {
      if (isAccessExpired(client)) {
        notify('Seu acesso expirou. Entre em contato com o suporte.', 'error');
        setLoading(false);
        return;
      }
      // With real Supabase auth, we don't know if they have a password set in Auth yet 
      // without trying to sign in or checking metadata.
      // For simplicity, we'll assume if they are in 'clients' but don't have a 'password' field 
      // in our local data, it's first access.
      if (!client.password) {
        setStep('first-access');
        notify('Detectamos seu primeiro acesso!', 'success');
      } else {
        setStep('password');
      }
    } else {
      notify('Acesso não encontrado.', 'error');
    }
    setLoading(false);
  };

  const handleFinalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const eTrim = email.trim().toLowerCase();

    // ADMIN BYPASS: If email matches and password is 'admin123', allow login
    if (eTrim === theme.adminEmail.toLowerCase() && password === 'admin123') {
      const adminUser: User = { 
        id: 'admin', 
        name: 'Master Admin', 
        email: eTrim, 
        role: 'admin', 
        status: 'active', 
        accessType: 'lifetime', 
        startDate: new Date().toISOString(), 
        purchasedProducts: [] 
      };
      setUser(adminUser);
      localStorage.setItem('bs_auth_user', JSON.stringify(adminUser));
      navigate('/admin');
      setLoading(false);
      return;
    }

    try {
      if (step === 'first-access') {
        const error = validatePassword(password);
        if (error) {
          setPasswordError(error);
          setLoading(false);
          return;
        }
        await signUp(eTrim, password, name);
        notify('Conta criada com sucesso!', 'success');
        // syncUser in AppProvider will handle the state
      } else {
        await signIn(eTrim, password);
        // syncUser in AppProvider will handle the state
      }
      
      // Navigation will be handled by useEffect watching user state or just manual if needed
      // But AppProvider handles user state change, so we can just wait or navigate
      if (eTrim === theme.adminEmail.toLowerCase()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      notify(err.message || 'Erro ao realizar login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate email sending
    setTimeout(() => {
      notify('Instruções de recuperação enviadas para o seu e-mail.', 'success');
      setStep('email');
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-stone-100" style={{ backgroundColor: theme.backgroundColor }}>
      <div className="absolute inset-0 z-0">
         <img src={theme.loginBannerUrl} className="w-full h-full object-cover opacity-60" alt="Fundo" />
         <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"></div>
      </div>
      
      {/* Tagline Desktop */}
      <div className="hidden lg:block absolute left-32 bottom-20 z-20 max-w-2xl space-y-4 animate-in slide-in-from-left-20 duration-1000">
         <h1 className="text-white text-7xl font-black uppercase italic tracking-tighter leading-none drop-shadow-2xl">{theme.loginTagline}</h1>
         <div className="bg-black/20 backdrop-blur-md px-6 py-3 rounded-full inline-flex items-center gap-3 text-white font-bold text-xs uppercase tracking-widest"><Sparkles className="text-orange-500" size={16}/> {theme.loginSubTagline}</div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-end lg:pr-32 relative z-10 p-6 gap-10">
        {/* Tagline Mobile */}
        <div className="lg:hidden text-center space-y-3 z-20 animate-in fade-in slide-in-from-top-10 duration-1000">
           <h1 className="text-white text-4xl font-black uppercase italic tracking-tighter leading-none drop-shadow-2xl">{theme.loginTagline}</h1>
           <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">{theme.loginSubTagline}</p>
        </div>

        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl p-10 md:p-16 rounded-[50px] md:rounded-[60px] shadow-2xl border border-white/60 text-center animate-in zoom-in-95 flex flex-col gap-12">
           <div className="flex flex-col items-center justify-center text-center leading-none select-none">
              <span className="font-bold tracking-tight text-lg" style={{ color: theme.secondaryColor }}>Cardápio do</span>
              <span className="font-black -mt-0.5 text-2xl" style={{ color: theme.secondaryColor }}>Bebê</span>
           </div>
           
           {step === 'email' ? (
             <form onSubmit={handleEmailCheck} className="space-y-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">BEM-VINDO(A)!</h2>
                <div className="space-y-4">
                   <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-stone-50 p-6 rounded-[30px] border border-stone-100 font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" placeholder="E-mail do Pai ou Mãe" />
                   <button disabled={loading} type="submit" className="w-full py-6 bg-black text-white rounded-[35px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: theme.primaryColor }}>{loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'AVANÇAR'}</button>
                </div>
             </form>
           ) : step === 'forgot-password' ? (
             <form onSubmit={handleForgotPassword} className="space-y-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">RECUPERAR SENHA</h2>
                <p className="text-xs font-bold text-stone-400">Enviaremos as instruções para o seu e-mail.</p>
                <div className="space-y-4">
                   <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-stone-50 p-6 rounded-[30px] border border-stone-100 font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" placeholder="E-mail do Pai ou Mãe" />
                   <button disabled={loading} type="submit" className="w-full py-6 bg-black text-white rounded-[35px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: theme.primaryColor }}>{loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'ENVIAR INSTRUÇÕES'}</button>
                   <button type="button" onClick={()=>setStep('email')} className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">VOLTAR PARA O LOGIN</button>
                </div>
             </form>
           ) : (
             <form onSubmit={handleFinalLogin} className="space-y-8">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">
                  {step === 'first-access' ? 'CRIE SUA SENHA' : 'SUA SENHA'}
                </h2>
                {step === 'first-access' && (
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Detectamos seu primeiro acesso. Crie uma senha segura para continuar.
                  </p>
                )}
                <div className="space-y-4">
                   {step === 'first-access' && (
                     <input 
                       type="text" 
                       required 
                       value={name} 
                       onChange={e => setName(e.target.value)} 
                       className="w-full bg-stone-50 p-6 rounded-[30px] border border-stone-100 font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
                       placeholder="Seu Nome Completo" 
                     />
                   )}
                   <div className="relative">
                     <input type={showPass ? "text" : "password"} required value={password} onChange={e=>{setPassword(e.target.value); setPasswordError('');}} className={`w-full bg-stone-50 p-6 rounded-[30px] border font-bold text-center focus:ring-2 outline-none transition-all ${passwordError ? 'border-red-500 focus:ring-red-500/20' : 'border-stone-100 focus:ring-orange-500/20'}`} placeholder="Senha" />
                     <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-6 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                   </div>
                   {passwordError && <p className="text-[10px] font-bold text-red-500">{passwordError}</p>}
                   <button disabled={loading} type="submit" className="w-full py-6 bg-black text-white rounded-[35px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: theme.primaryColor }}>{loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (step === 'first-access' ? 'CRIAR ACESSO' : 'ENTRAR')}</button>
                   <div className="flex flex-col gap-3 pt-2">
                     {step === 'password' && (
                       <button type="button" onClick={()=>setStep('forgot-password')} className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">ESQUECI MINHA SENHA</button>
                     )}
                     <button type="button" onClick={()=>setStep('email')} className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">VOLTAR PARA O E-MAIL</button>
                   </div>
                </div>
             </form>
           )}
        </div>
      </div>
    </div>
  );
};

function DashboardView() {
  const { products, user, theme, notices, banners, allCategories } = useApp();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const accessible = products.filter(p => user?.role === 'admin' || user?.purchasedProducts?.some(ap => ap.productId === p.id));
  
  const filteredProducts = useMemo(() => {
    let list = accessible.filter(p => !p.isBonus);
    if (selectedCategory) {
      list = list.filter(p => p.category === selectedCategory);
    }
    return list;
  }, [accessible, selectedCategory]);

  const activeNotices = notices.filter(n => n.active);
  const activeBanners = banners.filter(b => b.active).sort((a, b) => a.order - b.order);

  const nextBanner = () => {
    setCurrentBanner(prev => (prev + 1) % activeBanners.length);
  };

  const prevBanner = () => {
    setCurrentBanner(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(nextBanner, 5000);
    return () => clearInterval(interval);
  }, [activeBanners]);

  return (
    <div className="space-y-8 md:space-y-16 pb-32">
      <div className="flex flex-col gap-2 mb-4 md:mb-8">
         <span className="text-[8px] md:text-[10px] font-black text-stone-400 uppercase tracking-[0.4em]">
           Sua biblioteca digital
         </span>
         <h1 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter" style={{ color: theme.dashboardTitleColor }}>ALIMENTAÇÃO SAUDÁVEL</h1>
         <p className="text-stone-500 text-xs md:text-sm font-medium max-w-2xl mt-2 leading-relaxed">
           Transforme a alimentação do seu bebê com receitas práticas, saudáveis e cheias de amor. O passo a passo completo para uma introdução alimentar de sucesso!
         </p>
      </div>

      {activeBanners.length > 0 && (
        <div className="relative w-full aspect-[2/1] md:aspect-[3/1] rounded-[24px] md:rounded-[32px] overflow-hidden shadow-xl group lg:max-h-[420px] bg-stone-200">
          {activeBanners.map((banner, index) => (
            <a key={banner.id} href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentBanner ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
               <picture className="w-full h-full block">
                  <source media="(max-width: 768px)" srcSet={banner.mobileImageUrl || banner.desktopImageUrl} />
                  <img src={banner.desktopImageUrl} className="w-full h-full object-cover transition-transform duration-10000 group-hover:scale-105" alt={banner.title} />
               </picture>
               {(banner.title || banner.subtitle) && (
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 md:p-12">
                    {banner.title && <h2 className="text-white text-lg md:text-4xl font-black uppercase italic tracking-tighter leading-none mb-1 md:mb-2">{banner.title}</h2>}
                    {banner.subtitle && <p className="text-white/80 text-[8px] md:text-xs font-bold uppercase tracking-widest">{banner.subtitle}</p>}
                 </div>
               )}
            </a>
          ))}

          {activeBanners.length > 1 && (
            <>
              <button onClick={(e) => { e.preventDefault(); prevBanner(); }} className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40">
                <ChevronLeft size={20} className="md:hidden" />
                <ChevronLeft size={24} className="hidden md:block" />
              </button>
              <button onClick={(e) => { e.preventDefault(); nextBanner(); }} className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40">
                <ChevronRight size={20} className="md:hidden" />
                <ChevronRight size={24} className="hidden md:block" />
              </button>
              
              <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-2">
                {activeBanners.map((_, i) => (
                  <button key={i} onClick={(e) => { e.preventDefault(); setCurrentBanner(i); }} className={`h-1 md:h-1.5 rounded-full transition-all ${i === currentBanner ? 'w-6 md:w-8 bg-white' : 'w-1.5 md:w-2 bg-white/40'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 md:gap-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`px-6 md:px-8 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${!selectedCategory ? 'text-white shadow-lg' : 'bg-white text-stone-400 border border-stone-100 hover:bg-stone-50'}`}
          style={!selectedCategory ? { backgroundColor: theme.primaryColor } : {}}
        >
          TODOS
        </button>
        {allCategories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-6 md:px-8 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat ? 'text-white shadow-lg' : 'bg-white text-stone-400 border border-stone-100 hover:bg-stone-50'}`}
            style={selectedCategory === cat ? { backgroundColor: theme.primaryColor } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-12">
        {filteredProducts.map(p => {
          const purchase = user?.purchasedProducts?.find(x => x.productId === p.id);
          const status = getReleaseStatus(p, purchase?.purchaseDate);
          return (
            <Link key={p.id} to={status.isReleased ? `/viewer/${p.id}` : '#'} className="block rounded-[20px] md:rounded-[32px] p-2 md:p-3 shadow-md md:shadow-lg transition-all duration-700 hover:-translate-y-2 hover:shadow-xl overflow-hidden bg-white border border-stone-100">
              <div className="relative aspect-[3/4] rounded-[16px] md:rounded-[24px] overflow-hidden mb-2 md:mb-4">
                <img src={p.coverImage} className={`w-full h-full object-cover ${!status.isReleased ? 'grayscale opacity-60' : ''}`} alt={p.name} />
                {!status.isReleased && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center text-white"><Lock size={20} className="md:hidden"/><Lock size={24} className="hidden md:block"/></div>}
              </div>
              <div className="px-2 md:px-4 pb-2 md:pb-4 text-center">
                 <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest block mb-0.5 md:mb-1" style={{ color: theme.primaryColor }}>{p.category}</span>
                 <h3 className="text-[9px] md:text-xs font-black uppercase italic tracking-tighter leading-tight line-clamp-2">{p.name}</h3>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// MÓDULO: PAINEL ADMINISTRATIVO (ADMIN)
// ==========================================

const AdminView = () => {
  const { products, clients, theme, setTheme, setThemeState, allCategories, saveProduct, deleteProduct, saveClient, deleteClient, notify, banners, saveBanners, notices, saveNotice, deleteNotice, seedTestData, clearAllData, checkDatabase, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'CLIENTS' | 'NOTICES' | 'BANNERS' | 'SUPPORT' | 'INTEGRATION' | 'BRANDING'>('CATALOG');
  
  const [dbStatus, setDbStatus] = useState<Record<string, boolean>>({});
  const [isCheckingDb, setIsCheckingDb] = useState(false);

  const handleCheckDb = async () => {
    setIsCheckingDb(true);
    const results = await checkDatabase();
    setDbStatus(results);
    setIsCheckingDb(false);
    notify('Verificação de banco de dados concluída!', 'success');
  };
  
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<User> | null>(null);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Partial<Notice> | null>(null);
  const [simulatedJson, setSimulatedJson] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [localBanners, setLocalBanners] = useState<PromotionBanner[]>([]);
  useEffect(() => {
    const current = [...banners].sort((a,b) => a.order - b.order);
    const slots: PromotionBanner[] = [];
    for(let i=1; i<=3; i++) {
      const existing = current.find(b => b.order === i);
      slots.push(existing || { id: `banner-slot-${i}`, desktopImageUrl: '', mobileImageUrl: '', title: '', subtitle: '', linkUrl: '', active: false, order: i });
    }
    setLocalBanners(slots);
  }, [banners]);

  const tabs = [
    { id: 'CATALOG', label: 'CATALOG' },
    { id: 'CLIENTS', label: 'CLIENTS' },
    { id: 'NOTICES', label: 'AVISOS' },
    { id: 'BANNERS', label: 'BANNERS' },
    { id: 'SUPPORT', label: 'SUPORTE' },
    { id: 'INTEGRATION', label: 'INTEGRAÇÃO' },
    { id: 'BRANDING', label: 'ESTILO' }
  ];

  const principalProducts = products.filter(p => !p.isBonus);

  return (
    <div className="space-y-12 pb-48">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: theme.adminPrimaryColor }}>Painel <span style={{ color: theme.primaryColor }}>Admin</span></h1>
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[30px] border border-stone-200">
          {tabs.map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'text-white shadow-lg' : 'text-stone-400 hover:text-stone-600'}`}
              style={activeTab === tab.id ? { backgroundColor: theme.adminPrimaryColor } : {}}
            >
              {tab.label}
            </button>
          ))}
          <button 
            onClick={logout} 
            className="px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all text-red-400 hover:text-red-600 hover:bg-red-50"
          >
            SAIR
          </button>
        </div>
      </div>

      {/* CATALOG TAB */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-12 animate-in fade-in">
           <div className="flex justify-end">
              <button 
                onClick={() => { setEditingProduct({ name: '', category: Category.ALIMENTACAO, releaseType: ReleaseType.IMMEDIATE, coverImage: '', pdfUrl: '', active: true, isBonus: false }); setShowProductForm(true); }} 
                className="px-8 py-3 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                style={{ backgroundColor: theme.adminPrimaryColor }}
              >
                <Plus size={14}/> NOVO PRODUTO
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map(p => (
                <div key={p.id} className="bg-white rounded-[40px] p-6 border border-stone-100 shadow-sm group relative">
                   <div className="aspect-[3/4] rounded-[30px] overflow-hidden mb-4 bg-stone-50">
                      <img src={p.coverImage} className="w-full h-full object-cover" alt={p.name} />
                   </div>
                   <div className="text-center space-y-1">
                      <h4 className="font-black uppercase italic text-[10px] text-stone-800">{p.name}</h4>
                      {p.isBonus && <span className="text-[8px] font-black text-emerald-500 uppercase">EXTRA VINCULADO</span>}
                   </div>
                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 rounded-[40px]">
                      <button onClick={() => { setEditingProduct(p); setShowProductForm(true); }} className="w-12 h-12 rounded-full bg-white text-orange-500 flex items-center justify-center"><Edit size={20}/></button>
                      <button onClick={() => deleteProduct(p.id)} className="w-12 h-12 rounded-full bg-white text-red-500 flex items-center justify-center"><Trash2 size={20}/></button>
                   </div>
                 </div>
               ))}
            </div>
         </div>
      )}

      {/* CLIENTS TAB */}
      {activeTab === 'CLIENTS' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex justify-end">
              <button 
                onClick={() => { setEditingClient({ id: `user-${Date.now()}`, name: '', email: '', role: 'user', status: 'active', accessType: '1year', startDate: new Date().toISOString(), purchasedProducts: [] }); setShowClientForm(true); }} 
                className="px-8 py-3 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                style={{ backgroundColor: theme.adminPrimaryColor }}
              >
                <Plus size={14}/> NOVO CLIENTE
              </button>
           </div>
           <div className="bg-white rounded-[40px] border border-stone-100 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                 <thead>
                    <tr className="bg-stone-50 text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">
                       <th className="px-10 py-6">ALUNO</th>
                       <th className="px-10 py-6">STATUS</th>
                       <th className="px-10 py-6">PRODUTOS</th>
                       <th className="px-10 py-6 text-right">AÇÕES</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-stone-50">
                    {clients.map(c => (
                       <tr key={c.id} className="text-xs group hover:bg-stone-50/50 transition-all">
                          <td className="px-10 py-6">
                             <div className="flex flex-col"><span className="font-black text-stone-800 uppercase italic">{c.name}</span><span className="text-[10px] font-bold text-stone-300">{c.email}</span></div>
                          </td>
                          <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase ${c.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{c.status}</span></td>
                          <td className="px-10 py-6 font-bold text-stone-400">{c.purchasedProducts?.length || 0} cursos</td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => { setEditingClient(c); setShowClientForm(true); }} className="p-3 bg-stone-100 text-stone-400 rounded-xl hover:bg-orange-500 hover:text-white"><Edit size={16}/></button>
                                <button onClick={() => deleteClient(c.id)} className="p-3 bg-stone-100 text-stone-400 rounded-xl hover:bg-red-500 hover:text-white"><Trash2 size={16}/></button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* NOTICES TAB */}
      {activeTab === 'NOTICES' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex justify-end">
              <button 
                onClick={() => { setEditingNotice({ title: '', content: '', type: 'info', active: true }); setShowNoticeForm(true); }} 
                className="px-8 py-3 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                style={{ backgroundColor: theme.adminPrimaryColor }}
              >
                <Plus size={14}/> NOVO AVISO
              </button>
           </div>
           <div className="grid grid-cols-1 gap-6">
              {notices.map(n => (
                 <div key={n.id} className="bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${n.active ? 'bg-emerald-50 text-emerald-500' : 'bg-stone-50 text-stone-300'}`}>
                          <Bell size={20} />
                       </div>
                       <div>
                          <h4 className="font-black uppercase italic text-sm text-stone-800">{n.title}</h4>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{n.type} • {n.active ? 'Ativo' : 'Inativo'}</p>
                       </div>
                    </div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => { setEditingNotice(n); setShowNoticeForm(true); }} className="p-3 bg-stone-50 text-stone-400 rounded-xl hover:bg-orange-500 hover:text-white transition-all"><Edit size={16}/></button>
                       <button onClick={() => deleteNotice(n.id)} className="p-3 bg-stone-50 text-stone-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* BANNERS TAB */}
      {activeTab === 'BANNERS' && (
        <div className="space-y-12 animate-in fade-in pb-48">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center"><ImageIcon size={20}/></div>
              <div className="flex flex-col">
                <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-stone-800">GESTÃO DO CARROSSEL (ATÉ 3 BANNERS)</h2>
                <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-1">Recomendado: Desktop 1920x640 (3:1) | Mobile 800x400 (2:1)</span>
              </div>
           </div>

           <div className="space-y-10">
              {localBanners.map((banner, index) => (
                <div key={banner.id} className="bg-white rounded-[40px] p-8 lg:p-10 border border-stone-100 shadow-sm relative group">
                   <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-black text-base italic shadow-lg">#{index + 1}</div>
                         <span className="text-[10px] font-black uppercase text-stone-300 tracking-[0.3em]">CONFIGURAÇÃO DO BANNER</span>
                      </div>
                      <button onClick={() => { const next = [...localBanners]; next[index].active = !banner.active; setLocalBanners(next); }} className={`px-6 py-2.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${banner.active ? 'bg-emerald-500 text-white' : 'bg-stone-50 text-stone-300 border border-stone-100'}`}>
                         {banner.active ? <Eye size={12}/> : <EyeOff size={12}/>} {banner.active ? 'ATIVO' : 'INATIVO'}
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">IMAGEM DESKTOP (URL)</label>
                        <input value={banner.desktopImageUrl} onChange={e=>{ const next = [...localBanners]; next[index].desktopImageUrl = e.target.value; setLocalBanners(next); }} placeholder="https://..." className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">IMAGEM MOBILE (URL)</label>
                        <input value={banner.mobileImageUrl} onChange={e=>{ const next = [...localBanners]; next[index].mobileImageUrl = e.target.value; setLocalBanners(next); }} placeholder="https://..." className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">TÍTULO (OPCIONAL)</label>
                        <input value={banner.title} onChange={e=>{ const next = [...localBanners]; next[index].title = e.target.value; setLocalBanners(next); }} placeholder="Texto de destaque" className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">SUBTÍTULO (OPCIONAL)</label>
                        <input value={banner.subtitle} onChange={e=>{ const next = [...localBanners]; next[index].subtitle = e.target.value; setLocalBanners(next); }} placeholder="Texto secundário" className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" />
                      </div>
                      <div className="col-span-full space-y-3">
                        <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">LINK DE DESTINO (EX: CHECKOUT HOTMART)</label>
                        <input value={banner.linkUrl} onChange={e=>{ const next = [...localBanners]; next[index].linkUrl = e.target.value; setLocalBanners(next); }} placeholder="https://pay.hotmart.com/..." className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" />
                      </div>

                      <div className="col-span-full pt-6 space-y-4">
                        <div className="flex items-center gap-3 px-4">
                           <span className="text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white px-3 py-1 rounded-full">PREVIEW DESKTOP</span>
                        </div>
                        <div className="relative aspect-[3/1] rounded-[40px] overflow-hidden bg-stone-50 border border-stone-100 flex items-center justify-center shadow-inner group-hover:scale-[1.01] transition-transform">
                           {banner.desktopImageUrl ? (
                             <img src={banner.desktopImageUrl} className="w-full h-full object-cover" alt="Preview" />
                           ) : (
                             <div className="flex flex-col items-center gap-3 text-stone-200">
                               <ImageIcon size={40} strokeWidth={1}/>
                               <span className="text-[10px] font-bold uppercase tracking-widest">Sem imagem configurada</span>
                             </div>
                           )}
                        </div>
                      </div>
                   </div>
                </div>
              ))}
           </div>

           <div className="fixed bottom-24 md:bottom-10 left-6 md:left-[132px] right-6 md:right-12 z-[250]">
              <button 
                onClick={async () => { await saveBanners(localBanners); notify('Banners salvos!', 'success'); }} 
                className="w-full py-6 text-white rounded-[30px] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] transition-all transform"
                style={{ backgroundColor: theme.adminPrimaryColor }}
              >
                <Save size={16}/> SALVAR ALTERAÇÕES DO CARROSSEL
              </button>
           </div>
        </div>
      )}

      {/* SUPPORT TAB */}
      {activeTab === 'SUPPORT' && (
        <div className="space-y-12 animate-in fade-in pb-48">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center"><MessageCircle size={20}/></div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-stone-800">CONFIGURAÇÃO DE SUPORTE</h2>
           </div>

           <div className="bg-white rounded-[50px] p-14 border border-stone-100 shadow-sm space-y-12">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">WHATSAPP DE SUPORTE</h3>
                  <p className="text-[10px] font-bold text-stone-400">Ative ou desative o botão de suporte flutuante para seus alunos.</p>
                </div>
                <button 
                  onClick={() => setThemeState(prev => ({...prev, supportWhatsappActive: !prev.supportWhatsappActive}))}
                  className={`w-16 h-8 rounded-full transition-all relative ${theme.supportWhatsappActive ? 'bg-emerald-500' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${theme.supportWhatsappActive ? 'left-9' : 'left-1 shadow-sm'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-stone-50">
                 <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">NÚMERO DO WHATSAPP (COM DDD)</label>
                    <input 
                      value={theme.supportWhatsappNumber} 
                      onChange={e => setThemeState(prev => ({...prev, supportWhatsappNumber: e.target.value}))}
                      placeholder="Ex: 5511999999999" 
                      className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/10" 
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">MENSAGEM INICIAL (OPCIONAL)</label>
                    <input 
                      value={theme.supportWhatsappMessage} 
                      onChange={e => setThemeState(prev => ({...prev, supportWhatsappMessage: e.target.value}))}
                      placeholder="Olá, preciso de ajuda com o portal..." 
                      className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/10" 
                    />
                 </div>
              </div>

              <div className="pt-8 flex justify-end">
                <button 
                  onClick={() => setTheme()}
                  className="px-10 py-4 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-3"
                >
                  <Save size={16}/> SALVAR CONFIGURAÇÕES DE SUPORTE
                </button>
              </div>
           </div>
        </div>
      )}

      {/* INTEGRATION TAB */}
      {activeTab === 'INTEGRATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in fade-in pb-48">
          <div className="lg:col-span-2 space-y-12">
            <div className="bg-white rounded-[50px] p-14 border border-stone-100 shadow-sm space-y-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
                  <Zap size={24} />
                </div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter">AUTOMAÇÃO DE VENDAS</h2>
              </div>

              <div className="relative bg-stone-900 rounded-[40px] p-12 overflow-hidden group">
                <div className="absolute right-[-40px] top-[-20px] opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-1000">
                  <Shield size={240} />
                </div>
                
                <div className="relative z-10 space-y-8">
                  <div className="space-y-2">
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-orange-500">// ENDPOINT SEGURO PARA WEBHOOK</span>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">URL:</p>
                      <p className="text-lg font-black text-white tracking-tight">HTTPS://APPCARDAPIODOBEBE.APP/WEBHOOK</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-emerald-500">
                    <Check size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest">TOKEN DE SEGURANÇA ATIVO</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <ChevronRight size={14} className="text-orange-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-stone-300">TESTE REAL DE CARGA (JSON)</span>
                </div>

                <div className="space-y-6">
                  <textarea 
                    value={simulatedJson}
                    onChange={e => setSimulatedJson(e.target.value)}
                    placeholder="Cole o JSON da Hotmart aqui para processar..."
                    className="w-full h-48 bg-stone-50 rounded-[32px] p-8 font-mono text-xs text-stone-400 outline-none focus:ring-2 focus:ring-orange-500/10 border border-stone-100 resize-none"
                  />
                  
                  <button 
                    onClick={() => {
                      if(!simulatedJson) return notify('Cole um JSON válido.', 'error');
                      notify('Simulação enviada!', 'success');
                    }}
                    className="w-full py-6 bg-black text-white rounded-[30px] font-black text-[10px] uppercase tracking-[0.4em] shadow-xl hover:bg-stone-800 transition-all"
                  >
                    SIMULAR RECEBIMENTO DE VENDA
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-[50px] p-10 border border-stone-100 shadow-sm min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <Activity size={18} className="text-orange-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-800">AUDITORIA EM TEMPO REAL</h3>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center">
                  <Activity size={32} strokeWidth={1} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">SEM ATIVIDADE RECENTE.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BRANDING PLACEHOLDER */}
      {activeTab === 'BRANDING' && (
        <div className="space-y-12 animate-in fade-in pb-48">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center"><Palette size={20}/></div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-stone-800">PERSONALIZAÇÃO E BRANDING</h2>
           </div>
           
           <div className="bg-white rounded-[50px] p-10 md:p-14 border border-stone-100 shadow-sm space-y-12">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">DADOS DE TESTE</h3>
                  <p className="text-[10px] font-bold text-stone-400">Clique no botão ao lado para preencher o portal com imagens e dados de exemplo.</p>
                </div>
                <button onClick={seedTestData} className="px-8 py-4 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-lg"><Zap size={16} className="text-orange-500"/> CARREGAR DADOS DE TESTE</button>
                <button onClick={clearAllData} className="px-8 py-4 bg-red-50 text-red-500 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-red-100 transition-all shadow-sm"><Trash2 size={16}/> LIMPAR BANCO DE DADOS</button>
              </div>

              <div className="space-y-6 pt-12 border-t border-stone-50">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">STATUS DO BANCO DE DADOS</h3>
                    <p className="text-[10px] font-bold text-stone-400">Verifique se as tabelas necessárias foram criadas no Supabase.</p>
                  </div>
                  <button 
                    onClick={handleCheckDb} 
                    disabled={isCheckingDb}
                    className="px-8 py-4 bg-stone-100 text-stone-800 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-stone-200 transition-all disabled:opacity-50"
                  >
                    {isCheckingDb ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} className="text-emerald-500"/>} 
                    VERIFICAR TABELAS
                  </button>
                </div>

                {Object.keys(dbStatus).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
                    {Object.entries(dbStatus).map(([table, exists]) => (
                      <div key={table} className={`p-4 rounded-2xl border flex items-center justify-between ${exists ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">{table}</span>
                        {exists ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BANNERS E LINKS */}
              <div className="space-y-8 pt-12 border-t border-stone-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center"><ImageIcon size={16}/></div>
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">BANNERS E LINKS</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">BANNER DESKTOP (URL)</label>
                       <input 
                        value={theme.loginBannerUrl} 
                        onChange={e => setThemeState(prev => ({...prev, loginBannerUrl: e.target.value}))}
                        className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" 
                        placeholder="https://..."
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">SITE OFICIAL (LINK)</label>
                       <input 
                        value={theme.externalSiteUrl} 
                        onChange={e => setThemeState(prev => ({...prev, externalSiteUrl: e.target.value}))}
                        className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" 
                        placeholder="https://..."
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">BANNER MOBILE (URL)</label>
                       <input 
                        value={theme.loginMobileImageUrl} 
                        onChange={e => setThemeState(prev => ({...prev, loginMobileImageUrl: e.target.value}))}
                        className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" 
                        placeholder="https://..."
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase tracking-widest text-stone-300 px-4">FRASE DE IMPACTO (LOGIN)</label>
                       <input 
                        value={theme.loginTagline} 
                        onChange={e => setThemeState(prev => ({...prev, loginTagline: e.target.value}))}
                        className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500/10" 
                        placeholder="Ex: Nutrição que transforma vidas"
                       />
                    </div>
                 </div>
              </div>

              {/* GERENCIAMENTO DE CATEGORIAS */}
              <div className="space-y-8 pt-12 border-t border-stone-50">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center"><Layers size={16}/></div>
                      <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">GERENCIAMENTO DE CATEGORIAS</h3>
                   </div>
                    <button 
                      onClick={() => {
                        const name = prompt('Nome da nova categoria:');
                        if (name && name.trim()) {
                          const trimmedName = name.trim();
                          setThemeState(prev => {
                            if (prev.customCategories?.includes(trimmedName)) {
                              notify('Esta categoria já existe.', 'error');
                              return prev;
                            }
                            notify('Categoria adicionada!', 'success');
                            return {
                              ...prev,
                              customCategories: [...(prev.customCategories || []), trimmedName]
                            };
                          });
                        }
                      }}
                      className="px-6 py-2 bg-stone-100 text-stone-600 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                    >
                      + NOVA CATEGORIA
                    </button>
                 </div>
                 <div className="flex flex-wrap gap-3">
                   {(theme.customCategories || []).map((cat, idx) => (
                     <div key={idx} className="bg-stone-50 px-6 py-3 rounded-full border border-stone-100 flex items-center gap-4 group">
                       <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{cat}</span>
                       <button 
                         onClick={() => {
                           if (confirm(`Deseja remover a categoria "${cat}"? Isso não afetará os produtos já cadastrados.`)) {
                             setThemeState(prev => ({...prev, customCategories: (prev.customCategories || []).filter(c => c !== cat)}));
                           }
                         }}
                         className="text-stone-300 hover:text-red-500 transition-colors"
                       >
                         <X size={14} />
                       </button>
                     </div>
                   ))}
                 </div>
              </div>

              {/* CORES: ÁREA DO ALUNO */}
              <div className="space-y-8 pt-12 border-t border-stone-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center"><LayoutIcon size={16}/></div>
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">CORES: ÁREA DO ALUNO</h3>
                 </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { key: 'primaryColor', label: 'COR PRINCIPAL' },
                      { key: 'secondaryColor', label: 'COR SECUNDÁRIA' },
                      { key: 'accentColor', label: 'COR ACCENT (SELO)' },
                      { key: 'backgroundColor', label: 'FUNDO GLOBAL' },
                      { key: 'sidebarColor', label: 'FUNDO SIDEBAR' },
                      { key: 'headerColor', label: 'FUNDO HEADER' },
                      { key: 'textColor', label: 'COR DO TEXTO' },
                      { key: 'buttonTextColor', label: 'BOTÃO TEXTO' },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">{item.label}</label>
                        <div className="relative flex items-center">
                          <input 
                            type="text"
                            value={(theme as any)[item.key]} 
                            onChange={e => setThemeState(prev => ({...prev, [item.key]: e.target.value}))}
                            className="w-full p-4 pl-12 bg-stone-50 rounded-[20px] font-mono text-[10px] font-bold outline-none focus:ring-2 focus:ring-orange-500/10"
                          />
                          <label 
                            className="absolute left-4 w-5 h-5 rounded-md border border-stone-200 shadow-sm cursor-pointer overflow-hidden"
                            style={{ backgroundColor: (theme as any)[item.key] }}
                          >
                            <input 
                              type="color"
                              value={(theme as any)[item.key]} 
                              onChange={e => setThemeState(prev => ({...prev, [item.key]: e.target.value}))}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* CORES: PAINEL ADMINISTRATIVO */}
              <div className="space-y-8 pt-12 border-t border-stone-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center"><Settings size={16}/></div>
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-stone-300">CORES: PAINEL ADMINISTRATIVO</h3>
                 </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { key: 'adminPrimaryColor', label: 'DESTAQUE ADMIN' },
                      { key: 'adminSecondaryColor', label: 'SECUNDÁRIO ADMIN' },
                      { key: 'adminBackgroundColor', label: 'FUNDO ADMIN' },
                      { key: 'adminSidebarColor', label: 'SIDEBAR ADMIN' },
                      { key: 'adminHeaderColor', label: 'HEADER ADMIN' },
                      { key: 'adminTextColor', label: 'TEXTO ADMIN' },
                      { key: 'adminButtonColor', label: 'BOTÃO ADMIN' },
                      { key: 'adminButtonTextColor', label: 'BOTÃO TEXTO' },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">{item.label}</label>
                        <div className="relative flex items-center">
                          <input 
                            type="text"
                            value={(theme as any)[item.key]} 
                            onChange={e => setThemeState(prev => ({...prev, [item.key]: e.target.value}))}
                            className="w-full p-4 pl-12 bg-stone-50 rounded-[20px] font-mono text-[10px] font-bold outline-none focus:ring-2 focus:ring-orange-500/10"
                          />
                          <label 
                            className="absolute left-4 w-5 h-5 rounded-md border border-stone-200 shadow-sm cursor-pointer overflow-hidden"
                            style={{ backgroundColor: (theme as any)[item.key] }}
                          >
                            <input 
                              type="color"
                              value={(theme as any)[item.key]} 
                              onChange={e => setThemeState(prev => ({...prev, [item.key]: e.target.value}))}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* SAVE BUTTON SECTION */}
              <div className="pt-12 border-t border-stone-50">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-[40px] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-orange-500/20">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner">
                      <Palette size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-white font-black uppercase italic text-xl tracking-tight">PRONTO PARA APLICAR?</h3>
                      <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Suas alterações mudam todo o portal instantaneamente.</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      setIsSavingTheme(true);
                      try {
                        await setTheme();
                      } finally {
                        setIsSavingTheme(false);
                      }
                    }}
                    disabled={isSavingTheme}
                    className={`px-12 py-5 bg-white text-orange-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all ${isSavingTheme ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSavingTheme ? 'SALVANDO...' : 'SALVAR TODA A IDENTIDADE'}
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {showProductForm && editingProduct && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowProductForm(false); }}>
          <div className="bg-white w-full max-w-3xl p-8 md:p-12 rounded-[40px] shadow-2xl space-y-8 my-10 relative" onClick={e => e.stopPropagation()}>
              <button onClick={()=>setShowProductForm(false)} className="absolute right-6 top-6 w-10 h-10 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm z-10"><X size={20}/></button>
              
              <div className="text-center">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">CONFIGURAR PRODUTO {editingProduct.isBonus ? 'EXTRA' : 'PRINCIPAL'}</h3>
              </div>

              <div className="flex gap-2 bg-stone-50 p-1.5 rounded-full max-w-sm mx-auto">
                <button onClick={() => setEditingProduct({...editingProduct, isBonus: false})} className={`flex-1 py-3 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${!editingProduct.isBonus ? 'bg-black text-white shadow-lg' : 'text-stone-300'}`}>PRINCIPAL (COM IDI)</button>
                <button onClick={() => setEditingProduct({...editingProduct, isBonus: true})} className={`flex-1 py-3 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${editingProduct.isBonus ? 'bg-emerald-500 text-white shadow-lg' : 'text-stone-300'}`}>EXTRA (VINCULADO)</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="col-span-full space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">TÍTULO DO PRODUTO</label>
                  <input value={editingProduct.name} onChange={e=>setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="Ex: Guia de Papinhas" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300">CATEGORIA</label>
                    <button 
                      type="button"
                      onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                      className="text-[8px] font-black text-orange-500 uppercase tracking-widest hover:underline"
                    >
                      {showNewCategoryInput ? 'CANCELAR' : '+ CRIAR NOVA'}
                    </button>
                  </div>
                  
                  {showNewCategoryInput ? (
                    <div className="flex gap-2">
                      <input 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="flex-1 p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                        placeholder="Nome da categoria"
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (newCategoryName && newCategoryName.trim()) {
                            const trimmedName = newCategoryName.trim();
                            if (!allCategories.includes(trimmedName)) {
                              setThemeState(prev => ({
                                ...prev, 
                                customCategories: [...(prev.customCategories || []), trimmedName]
                              }));
                              notify('Categoria adicionada!', 'success');
                            }
                            setEditingProduct(prev => prev ? ({...prev, category: trimmedName}) : null);
                            setNewCategoryName('');
                            setShowNewCategoryInput(false);
                          }
                        }}
                        className="px-6 bg-orange-500 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest"
                      >
                        ADD
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select 
                        value={editingProduct.category} 
                        onChange={e => setEditingProduct(prev => prev ? ({...prev, category: e.target.value}) : null)}
                        className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none pr-12"
                      >
                        {/* Garantir que a categoria atual apareça mesmo que ainda não tenha sido salva no tema */}
                        {Array.from(new Set([...allCategories, editingProduct.category])).filter(Boolean).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-300">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">REGRA DE LIBERAÇÃO</label>
                  <select value={editingProduct.releaseType} onChange={e=>setEditingProduct({...editingProduct, releaseType: e.target.value as ReleaseType})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20">
                    <option value={ReleaseType.IMMEDIATE}>Imediato</option>
                    <option value={ReleaseType.SCHEDULED}>7 dias após a compra</option>
                    <option value={ReleaseType.CONDITIONAL}>Condicional</option>
                  </select>
                </div>

                {!editingProduct.isBonus ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">ID HOTMART (IDI)</label>
                      <input value={editingProduct.hotmartId || ''} onChange={e=>setEditingProduct({...editingProduct, hotmartId: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="Ex: 123456" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">LINK DE CHECKOUT</label>
                      <input value={editingProduct.checkoutUrl || ''} onChange={e=>setEditingProduct({...editingProduct, checkoutUrl: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="https://pay.hotmart.com/..." />
                    </div>
                  </>
                ) : (
                  <div className="col-span-full space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">VINCULAR AO PRODUTO PAI</label>
                    <select value={editingProduct.parentId || ''} onChange={e=>setEditingProduct({...editingProduct, parentId: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20">
                      <option value="">Selecione o produto principal...</option>
                      {principalProducts.filter(p => p.id !== editingProduct.id).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-full space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">DESCRIÇÃO DO PRODUTO</label>
                  <textarea value={editingProduct.description || ''} onChange={e=>setEditingProduct({...editingProduct, description: e.target.value})} rows={3} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" placeholder="Breve resumo sobre o conteúdo do e-book..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">CAPA (URL)</label>
                  <input value={editingProduct.coverImage} onChange={e=>setEditingProduct({...editingProduct, coverImage: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="URL da imagem de capa" />
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">PDF (URL)</label>
                  <input value={editingProduct.pdfUrl} onChange={e=>setEditingProduct({...editingProduct, pdfUrl: e.target.value})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="URL do arquivo PDF" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={()=>setShowProductForm(false)} className="flex-1 py-5 bg-stone-100 text-stone-400 rounded-[25px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-stone-200 transition-colors">CANCELAR</button>
                <button onClick={async () => { await saveProduct(editingProduct as Product); setShowProductForm(false); }} className="flex-[2] py-5 bg-orange-500 text-white rounded-[25px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-orange-600 transition-colors">SALVAR CONFIGURAÇÃO</button>
              </div>
          </div>
        </div>
      )}

      {showClientForm && editingClient && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowClientForm(false); }}>
          <div className="bg-white w-full max-w-xl p-8 md:p-12 rounded-[60px] shadow-2xl space-y-8 my-10 relative" onClick={e => e.stopPropagation()}>
              <button onClick={()=>setShowClientForm(false)} className="absolute right-8 top-8 w-10 h-10 rounded-full bg-stone-50 text-stone-300 flex items-center justify-center hover:bg-stone-100 transition-colors"><X size={20}/></button>
              
              <div className="text-center">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">GESTÃO DE ALUNO</h3>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">Nome Completo</label>
                    <input value={editingClient.name} onChange={e=>setEditingClient({...editingClient, name: e.target.value})} className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="Nome do aluno" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">E-mail de Acesso</label>
                    <input value={editingClient.email} onChange={e=>setEditingClient({...editingClient, email: e.target.value})} className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="email@exemplo.com" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">Status da Conta</label>
                    <select value={editingClient.status} onChange={e=>setEditingClient({...editingClient, status: e.target.value as any})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20">
                      <option value="active">Ativo</option>
                      <option value="suspended">Suspenso</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">Tipo de Acesso</label>
                    <select value={editingClient.accessType} onChange={e=>setEditingClient({...editingClient, accessType: e.target.value as any})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20">
                      <option value="1year">1 Ano</option>
                      <option value="7days">7 Dias</option>
                      <option value="30days">30 Dias</option>
                      <option value="lifetime">Vitalício</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">PRODUTOS ADQUIRIDOS:</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {products.map(p => {
                      const hasAccess = editingClient.purchasedProducts?.some(pp => pp.productId === p.id);
                      return (
                        <button 
                          key={p.id} 
                          onClick={() => {
                            const current = editingClient.purchasedProducts || [];
                            const next = hasAccess 
                              ? current.filter(pp => pp.productId !== p.id)
                              : [...current, { productId: p.id, purchaseDate: new Date().toISOString() }];
                            setEditingClient({...editingClient, purchasedProducts: next});
                          }}
                          className={`w-full p-4 rounded-[20px] flex items-center justify-between transition-all border ${hasAccess ? 'bg-orange-50 border-orange-100' : 'bg-stone-50 border-transparent opacity-60'}`}
                        >
                          <span className={`text-[10px] font-black uppercase italic tracking-tight ${hasAccess ? 'text-orange-600' : 'text-stone-400'}`}>{p.name}</span>
                          {hasAccess ? <Unlock size={16} className="text-orange-500" /> : <Lock size={16} className="text-stone-300" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button onClick={async () => { await saveClient(editingClient as User); setShowClientForm(false); }} className="w-full py-6 bg-black text-white rounded-[25px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-stone-800 transition-colors">CONFIRMAR</button>
          </div>
        </div>
      )}

      {showNoticeForm && editingNotice && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowNoticeForm(false); }}>
          <div className="bg-white w-full max-w-xl p-8 md:p-12 rounded-[60px] shadow-2xl space-y-8 my-10 relative" onClick={e => e.stopPropagation()}>
              <button onClick={()=>setShowNoticeForm(false)} className="absolute right-8 top-8 w-10 h-10 rounded-full bg-stone-50 text-stone-300 flex items-center justify-center hover:bg-stone-100 transition-colors"><X size={20}/></button>
              
              <div className="text-center">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">GESTÃO DE AVISO</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">TÍTULO DO AVISO</label>
                  <input value={editingNotice.title} onChange={e=>setEditingNotice({...editingNotice, title: e.target.value})} className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="Ex: Manutenção Programada" />
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">CONTEÚDO</label>
                  <textarea value={editingNotice.content} onChange={e=>setEditingNotice({...editingNotice, content: e.target.value})} rows={4} className="w-full p-5 bg-stone-50 rounded-[25px] font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" placeholder="Descreva o aviso aqui..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">TIPO</label>
                    <select value={editingNotice.type} onChange={e=>setEditingNotice({...editingNotice, type: e.target.value as any})} className="w-full p-4 bg-stone-50 rounded-[20px] font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-orange-500/20">
                      <option value="info">Informação</option>
                      <option value="warning">Aviso</option>
                      <option value="promotion">Promoção</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-300 px-4">STATUS</label>
                    <button onClick={() => setEditingNotice({...editingNotice, active: !editingNotice.active})} className={`w-full p-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all ${editingNotice.active ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-400'}`}>
                      {editingNotice.active ? 'ATIVO' : 'INATIVO'}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={async () => { await saveNotice(editingNotice as Notice); setShowNoticeForm(false); }} className="w-full py-6 bg-black text-white rounded-[25px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-stone-800 transition-colors">SALVAR AVISO</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// CORE: PROVIDER E BOOTSTRAP
// ==========================================

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [banners, setBanners] = useState<PromotionBanner[]>([]);
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...Object.values(Category),
      ...(theme.customCategories || [])
    ]));
  }, [theme.customCategories]);

  const notify = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadData = async () => {
    try {
      const [pRes, cRes, tRes, nRes, bRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('settings').select('*').eq('key', 'theme').maybeSingle(),
        supabase.from('notices').select('*'),
        supabase.from('settings').select('*').eq('key', 'banners_carousel').maybeSingle()
      ]);
      
      if (pRes.data) {
        setProducts(pRes.data.map(x => (x.data || x.value) as Product));
      }

      if (cRes.data) {
        const mappedClients = cRes.data.map(x => (x.data || x.value) as User);
        setClients(mappedClients);
      }
      
      if (tRes.data) {
        const themeData = tRes.data.data || tRes.data.value;
        if (themeData) {
          setThemeState(prev => ({...DEFAULT_THEME, ...prev, ...themeData}));
        }
      }

      if (nRes.data) {
        setNotices(nRes.data.map(x => (x.data || x.value) as Notice));
      }

      if (bRes.data) {
        const bannersData = bRes.data.data || bRes.data.value;
        if (bannersData) {
          setBanners(bannersData);
        }
      }
    } catch (e) { 
      console.error('Error loading data:', e); 
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await loadData();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncUser(session.user.email!);
      } else {
        // Fallback to localStorage for simulated session (especially for admin bypass)
        const saved = localStorage.getItem('bs_auth_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Verify if it's the admin email from theme
            if (parsed.email.toLowerCase() === theme.adminEmail.toLowerCase()) {
              setUser(parsed);
            } else {
              // For students, we might want to be stricter or allow simulated if not in Auth yet
              setUser(parsed);
            }
          } catch (e) {
            localStorage.removeItem('bs_auth_user');
          }
        }
      }
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await syncUser(session.user.email!);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('bs_auth_user');
        }
      });

      setLoading(false);
      return () => subscription.unsubscribe();
    };

    initAuth();
  }, [theme.adminEmail]); // Re-run if admin email changes in settings

  const syncUser = async (email: string) => {
    // Check if it's admin
    if (email.toLowerCase() === theme.adminEmail.toLowerCase()) {
      setUser({ id: 'admin', name: 'Master Admin', email, role: 'admin', status: 'active', accessType: 'lifetime', startDate: new Date().toISOString(), purchasedProducts: [] });
      return;
    }

    // Fetch client data
    const { data } = await supabase.from('clients').select('*').eq('id', email).maybeSingle();
    if (data) {
      setUser((data.data || data.value) as User);
    } else {
      // If not found in clients, maybe it's a new user or just auth user
      // We can create a default user or just set null if not authorized
      setUser(null);
    }
  };

  const value = {
    user, setUser, products, clients, theme, loading, notices, banners, allCategories,
    saveProduct: async (p: Product) => { 
      try {
        const id = p.id || `prod-${Date.now()}`; 
        const { error } = await supabase.from('products').upsert({ id, data: { ...p, id } }, { onConflict: 'id' });
        if (error) {
          const { error: error2 } = await supabase.from('products').upsert({ id, value: { ...p, id } }, { onConflict: 'id' });
          if (error2) throw error2;
        }
        await loadData(); 
        notify('Produto salvo com sucesso!', 'success'); 
      } catch (err: any) {
        console.error('Error saving product:', err);
        notify(`Erro ao salvar produto: ${err.message}`, 'error');
      }
    },
    deleteProduct: async (id: string) => { 
      try {
        const { error } = await supabase.from('products').delete().eq('id', id); 
        if (error) throw error;
        await loadData(); 
        notify('Produto removido.', 'success'); 
      } catch (err: any) {
        console.error('Error deleting product:', err);
        notify('Erro ao remover produto.', 'error');
      }
    },
    saveClient: async (c: User) => { 
      try {
        const updated = { ...c, expiryDate: calculateExpiryDate(c.startDate, c.accessType) };
        const { error } = await supabase.from('clients').upsert({ id: c.email, data: updated }, { onConflict: 'id' }); 
        if (error) {
          const { error: error2 } = await supabase.from('clients').upsert({ id: c.email, value: updated }, { onConflict: 'id' });
          if (error2) throw error2;
        }
        await loadData(); 
        notify('Cliente salvo!', 'success'); 
      } catch (err: any) {
        console.error('Error saving client:', err);
        notify(`Erro ao salvar cliente: ${err.message}`, 'error');
      }
    },
    deleteClient: async (id: string) => { 
      try {
        const { error } = await supabase.from('clients').delete().eq('id', id); 
        if (error) throw error;
        await loadData(); 
        notify('Cliente removido.', 'success'); 
      } catch (err: any) {
        console.error('Error deleting client:', err);
        notify('Erro ao remover cliente.', 'error');
      }
    },
    saveBanners: async (b: PromotionBanner[]) => { 
      try {
        const { error } = await supabase.from('settings').upsert({ key: 'banners_carousel', value: b }, { onConflict: 'key' }); 
        if (error) throw error;
        await loadData(); 
        notify('Banners salvos!', 'success'); 
      } catch (err: any) {
        console.error('Error saving banners:', err);
        notify(`Erro ao salvar banners: ${err.message || ''}`, 'error');
      }
    },
    setTheme: async () => { 
      try {
        const { error } = await supabase.from('settings').upsert({ key: 'theme', value: theme }, { onConflict: 'key' });
        if (error) throw error;
        await loadData();
        notify('Estilo aplicado com sucesso!', 'success'); 
      } catch (err: any) {
        console.error('Error saving theme:', err);
        notify(`Erro ao salvar estilo: ${err.message || ''}`, 'error');
      }
    },
    setThemeState,
    logout: async () => { 
      await supabase.auth.signOut();
      setUser(null); 
      localStorage.removeItem('bs_auth_user');
    },
    signIn: async (email: string, pass: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    },
    signUp: async (email: string, pass: string, name: string) => {
      const { error, data } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: { data: { full_name: name } }
      });
      if (error) throw error;
      
      // If sign up successful, we might need to update the client record if it exists
      const client = clients.find(c => c.email.toLowerCase() === email.toLowerCase());
      if (client) {
        await supabase.from('clients').update({ data: { ...client, name: name || client.name } }).eq('id', email);
      }
    },
    notify, refreshData: loadData,
    saveNotice: async (n: Notice) => { 
      try {
        const id = n.id || `notice-${Date.now()}`; 
        const { error } = await supabase.from('notices').upsert({ id, data: { ...n, id } }, { onConflict: 'id' }); 
        if (error) {
          const { error: error2 } = await supabase.from('notices').upsert({ id, value: { ...n, id } }, { onConflict: 'id' });
          if (error2) throw error2;
        }
        await loadData(); 
        notify('Aviso salvo!', 'success'); 
      } catch (err: any) {
        console.error('Error saving notice:', err);
        notify(`Erro ao salvar aviso: ${err.message}`, 'error');
      }
    },
    deleteNotice: async (id: string) => { 
      try {
        const { error } = await supabase.from('notices').delete().eq('id', id); 
        if (error) throw error;
        await loadData(); 
        notify('Aviso removido.', 'success'); 
      } catch (err: any) {
        console.error('Error deleting notice:', err);
        notify('Erro ao remover aviso.', 'error');
      }
    },
    seedTestData: async () => {
      setLoading(true);
      try {
        await Promise.all([
          ...INITIAL_PRODUCTS.map(p => supabase.from('products').upsert({ id: p.id, data: p }, { onConflict: 'id' })),
          ...INITIAL_NOTICES.map(n => supabase.from('notices').upsert({ id: n.id, data: n }, { onConflict: 'id' })),
          supabase.from('settings').upsert({ key: 'banners_carousel', value: INITIAL_BANNERS }, { onConflict: 'key' }),
          supabase.from('settings').upsert({ key: 'theme', value: DEFAULT_THEME }, { onConflict: 'key' })
        ]);
        await loadData();
        notify('Dados de teste carregados!', 'success');
      } catch (e) {
        console.error(e);
        notify('Erro ao carregar dados.', 'error');
      } finally {
        setLoading(false);
      }
    },
    clearAllData: async () => {
      if (!window.confirm("Isso apagará TODOS os produtos, clientes e avisos. Tem certeza?")) return;
      setLoading(true);
      try {
        // Delete all rows from tables
        // Note: Supabase requires a filter for delete, so we use neq('id', '0') which matches everything
        await Promise.all([
          supabase.from('products').delete().neq('id', '0'),
          supabase.from('clients').delete().neq('id', '0'),
          supabase.from('notices').delete().neq('id', '0')
        ]);
        await loadData();
        notify('Banco de dados limpo!', 'success');
      } catch (e) {
        console.error(e);
        notify('Erro ao limpar dados.', 'error');
      } finally {
        setLoading(false);
      }
    },
    checkDatabase: async () => {
      const tables = ['products', 'clients', 'settings', 'notices'];
      const results: Record<string, boolean> = {};
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          results[table] = !error;
          if (error) console.warn(`Table ${table} check failed:`, error.message);
        } catch (e) {
          results[table] = false;
        }
      }
      return results;
    }
  };

  return (<AppContext.Provider value={value}>{children}<div className="fixed bottom-10 right-10 z-[300] flex flex-col gap-4">{toasts.map(t => (<div key={t.id} className={`px-10 py-5 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 border bg-black text-white ${t.type === 'success' ? 'border-emerald-500' : 'border-red-500'}`}>{t.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}<span className="text-[10px] font-black uppercase tracking-widest">{t.message}</span></div>))}</div></AppContext.Provider>);
};

const PDFViewerView = () => {
  const { id } = useParams();
  const { products, theme, user } = useApp();
  const navigate = useNavigate();
  const product = products.find(p => p.id === id);
  if (!product) return <Navigate to="/dashboard" />;
  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: theme.backgroundColor }}>
      <header className="h-20 md:h-24 px-6 md:px-12 border-b flex items-center justify-between bg-white shadow-sm">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 md:gap-3 text-stone-400 font-black text-[8px] md:text-[9px] uppercase tracking-widest hover:text-stone-800 transition-colors"><ArrowLeft size={16} className="md:hidden"/><ArrowLeft size={18} className="hidden md:block"/> VOLTAR</button>
        <h2 className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter truncate max-w-[150px] md:max-w-none">{product.name}</h2>
        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-xs shadow-md" style={{ backgroundColor: theme.secondaryColor }}>{user?.name?.charAt(0)}</div>
      </header>
      <main className="flex-1 p-4 md:p-8 bg-stone-100 flex justify-center overflow-hidden">
        <iframe src={`${product.pdfUrl}#toolbar=0`} className="w-full h-full max-w-6xl bg-white shadow-2xl rounded-[24px] md:rounded-[40px] overflow-hidden border border-white" title={product.name} />
      </main>
    </div>
  );
};

function Layout({ children }: { children?: React.ReactNode }) {
  const { logout, user, theme, notices } = useApp();
  const [showNotices, setShowNotices] = useState(false);
  const activeNotices = notices.filter(n => n.active);

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: theme.backgroundColor }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-24 lg:w-32 bg-white border-r flex-col items-center py-12 sticky top-0 h-screen" style={{ backgroundColor: theme.sidebarColor }}>
        <div className="flex-1 flex flex-col gap-8">
          <Link to="/dashboard" className="w-14 h-14 bg-black text-white rounded-[20px] flex items-center justify-center shadow-xl hover:scale-105 transition-transform" style={{ backgroundColor: theme.primaryColor }}><LayoutIcon size={22}/></Link>
          {user?.role === 'admin' && <Link to="/admin" className="w-14 h-14 bg-blue-500/10 rounded-[20px] flex items-center justify-center text-blue-500 border border-blue-100 hover:scale-105 transition-transform"><Settings size={22}/></Link>}
        </div>
        <button onClick={logout} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"><LogOut size={20}/></button>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-[200] px-6 py-4 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.05)]" style={{ backgroundColor: theme.sidebarColor }}>
        <Link to="/dashboard" className="p-3 text-stone-400 hover:text-stone-800 transition-colors"><LayoutIcon size={24}/></Link>
        {user?.role === 'admin' && <Link to="/admin" className="p-3 text-stone-400 hover:text-stone-800 transition-colors"><Settings size={24}/></Link>}
        <button onClick={logout} className="p-3 text-red-400 hover:text-red-500 transition-colors"><LogOut size={24}/></button>
      </nav>

      <main className="flex-1 px-6 md:px-12 py-8 md:py-16 custom-scrollbar overflow-y-auto pb-32 md:pb-16">
        <header className="flex justify-between items-center mb-10 md:mb-16">
          <div className="flex flex-col items-start leading-none">
            <span className="font-bold tracking-tight text-[10px] md:text-sm text-stone-800">Cardápio do</span>
            <span className="font-black -mt-0.5 text-lg md:text-xl" style={{ color: theme.secondaryColor }}>Bebê</span>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative">
              <button 
                onClick={() => setShowNotices(!showNotices)}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${showNotices ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-stone-400 border border-stone-100 shadow-sm'}`}
              >
                <Bell size={18} className="md:hidden" />
                <Bell size={20} className="hidden md:block" />
                {activeNotices.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {activeNotices.length}
                  </span>
                )}
              </button>

              {showNotices && (
                <div className="absolute right-0 mt-4 w-[280px] md:w-80 bg-white rounded-[24px] md:rounded-[32px] shadow-2xl border border-stone-100 z-[100] p-5 md:p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-stone-50 pb-4">
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-300">Avisos e Notificações</span>
                    <button onClick={() => setShowNotices(false)} className="text-stone-300 hover:text-stone-500"><X size={14}/></button>
                  </div>
                  <div className="space-y-4 max-h-80 md:max-h-96 overflow-y-auto custom-scrollbar pr-2">
                    {theme.supportWhatsappActive && (
                      <a 
                        href={`https://wa.me/${theme.supportWhatsappNumber}?text=${encodeURIComponent(theme.supportWhatsappMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-emerald-50 rounded-xl md:rounded-2xl border border-emerald-100 group hover:bg-emerald-100 transition-all"
                      >
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <MessageCircle size={16} className="md:hidden" />
                          <MessageCircle size={20} className="hidden md:block" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[10px] md:text-[11px] font-black uppercase italic text-emerald-700">Suporte WhatsApp</h4>
                          <p className="text-[8px] md:text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">Fale conosco agora</p>
                        </div>
                        <ChevronRight size={14} className="text-emerald-400" />
                      </a>
                    )}

                    {activeNotices.length > 0 ? activeNotices.map(n => (
                      <div key={n.id} className="p-3 md:p-4 bg-stone-50 rounded-xl md:rounded-2xl space-y-1">
                        <h4 className="text-[10px] md:text-[11px] font-black uppercase italic text-stone-800">{n.title}</h4>
                        <p className="text-[9px] md:text-[10px] font-medium text-stone-500 leading-relaxed">{n.content}</p>
                      </div>
                    )) : (
                      <div className="py-6 md:py-8 text-center space-y-2">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-200"><BellOff size={20}/></div>
                        <p className="text-[9px] md:text-[10px] font-bold text-stone-300 uppercase tracking-widest">Nenhum aviso no momento</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-1.5 md:py-2 bg-stone-50 rounded-full border border-stone-100 shadow-sm">
              <div className="hidden sm:flex flex-col items-end leading-none">
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-stone-400">Bem-vindo(a),</span>
                <span className="text-[10px] md:text-xs font-black uppercase italic text-stone-800">{user?.name?.split(' ')[0] || 'Aluno(a)'}</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-black rounded-full flex items-center justify-center text-white font-black uppercase shadow-md border-2 border-white text-xs md:text-sm" style={{ backgroundColor: theme.secondaryColor }}>{user?.name?.charAt(0)}</div>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function AdminLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { theme } = useApp();
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: theme.adminBackgroundColor }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-24 lg:w-32 bg-white border-r flex-col items-center py-12 sticky top-0 h-screen" style={{ backgroundColor: theme.adminSidebarColor }}>
        <div className="flex-1 flex flex-col gap-8">
          <Link to="/dashboard" className="w-14 h-14 bg-stone-50 rounded-[20px] flex items-center justify-center text-stone-200 hover:text-stone-400 transition-colors">
            <LayoutIcon size={22}/>
          </Link>
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-xl text-white" style={{ backgroundColor: theme.adminPrimaryColor }}>
            <Settings size={22}/>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="p-4 bg-stone-50 text-stone-300 rounded-2xl hover:bg-stone-100 transition-colors">
          <ArrowLeft size={20}/>
        </button>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-[200] px-6 py-4 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.05)]" style={{ backgroundColor: theme.adminSidebarColor }}>
        <Link to="/dashboard" className="p-3 text-stone-300 hover:text-stone-500 transition-colors"><LayoutIcon size={24}/></Link>
        <div className="p-3" style={{ color: theme.adminPrimaryColor }}><Settings size={24}/></div>
        <button onClick={() => navigate('/dashboard')} className="p-3 text-stone-300 hover:text-stone-500 transition-colors"><ArrowLeft size={24}/></button>
      </nav>

      <main className="flex-1 px-6 md:px-12 py-8 md:py-16 overflow-y-auto pb-32 md:pb-16">
        <header className="flex justify-between items-center mb-10 md:mb-16" style={{ backgroundColor: theme.adminHeaderColor }}>
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] font-black text-stone-300 uppercase tracking-widest leading-none mb-1 md:mb-2">Administrador Master</span>
            <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter" style={{ color: theme.adminPrimaryColor }}>PAINEL ADMIN</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<LoginView />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardView /></Layout></ProtectedRoute>} />
          <Route path="/viewer/:id" element={<ProtectedRoute><PDFViewerView /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminLayout><AdminView /></AdminLayout></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  );
}

function ProtectedRoute({ children }: { children?: React.ReactNode }) { 
  const { user, loading, logout, notify } = useApp(); 
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isAccessExpired(user)) {
      notify('Seu acesso expirou.', 'error');
      logout();
      navigate('/');
    }
  }, [user]);

  if (loading) return <div className="h-screen bg-stone-950 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>; 
  return user ? <>{children}</> : <Navigate to="/" />; 
}
function AdminRoute({ children }: { children?: React.ReactNode }) { const { user, loading } = useApp(); if (loading) return <div className="h-screen bg-stone-950 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>; return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" />; }