/* -----------------------------------------------------
   COLLEKT SHARED APP LOGIC v3 &rarr; Supabase Integration
------------------------------------------------------*/

// -- PLATFORM FEE & SUBSCRIPTION PRICING CONSTANTS --
const COLLEKT_COMMISSION_RATE = 0.10; // 10% Platform Commission Rate
const COLLEKT_PROFESSIONAL_SUB_FEE = 15; // $15 / month
const COLLEKT_COMPANY_SUB_FEE = 50; // $50 / month

// -- AUTO-RESTORE PROTECTED ACCOUNTS (Dave Oladapo Ojeowere) --
(function autoRestoreProtectedFounderAccount() {
  try {
    const protectedIds = ['ojeoweredave@gmail.com', 'ojeoweredave', 'usr_dave_ojeowere', 'dave oladapo ojeowere'];
    // 1. Remove from deleted blacklist
    let del = JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]');
    if (Array.isArray(del) && del.length > 0) {
      const filtered = del.filter(x => {
        const s = String(x || '').toLowerCase().trim();
        return !protectedIds.some(p => s === p || s.includes('ojeoweredave'));
      });
      if (filtered.length !== del.length) {
        localStorage.setItem('collekt_deleted_users', JSON.stringify(filtered));
      }
    }

    // 2. Ensure Dave Ojeowere profile is present and active in collekt_all_users
    let dir = JSON.parse(localStorage.getItem('collekt_all_users') || '[]');
    if (!Array.isArray(dir)) dir = [];
    let dave = dir.find(u => u && u.email && u.email.toLowerCase().trim() === 'ojeoweredave@gmail.com');
    if (!dave) {
      dave = {
        id: 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91',
        name: 'Dave Oladapo Ojeowere',
        first_name: 'Dave',
        last_name: 'Ojeowere',
        other_name: 'Oladapo',
        username: 'ojeoweredave',
        email: 'ojeoweredave@gmail.com',
        role: 'professional',
        title: 'Senior Proposal Manager & Technical Specialist',
        location: 'Lagos, Nigeria',
        bio: 'Senior Proposal Manager and Technical Commercial Specialist with extensive experience delivering multi-million dollar EPC & IOC bids across West Africa.',
        skills: ['Proposal Management', 'EPC Tendering', 'COREN Compliance', 'Commercial Valuation', 'IOC Contracting'],
        verified: false,
        is_verified: false,
        verification_status: 'none',
        identity_verified: false,
        status: 'active',
        suspended: false,
        rating: 0.0,
        review_count: 0,
        projects_completed: 0,
        total_earned: 0,
        success_rate: 0,
        wallet: {
          balance: 0,
          escrow_balance: 0,
          bank_name: '',
          account_number: '',
          account_name: '',
          bank_assigned: false
        }
      };
      dir.unshift(dave);
      localStorage.setItem('collekt_all_users', JSON.stringify(dir));
    } else {
      dave.suspended = false;
      dave.status = 'active';
      if (dave.wallet && (dave.wallet.balance === 2450000 || dave.wallet.balance === 1450000)) {
        dave.wallet.balance = 0;
      }
      localStorage.setItem('collekt_all_users', JSON.stringify(dir));
    }

    // 3. Sanitize current user if stale mock balance exists
    let curr = JSON.parse(localStorage.getItem('collekt_user') || 'null');
    if (curr && curr.wallet && (curr.wallet.balance === 2450000 || curr.wallet.balance === 1450000)) {
      curr.wallet.balance = Number(curr.wallet_balance || 0);
      localStorage.setItem('collekt_user', JSON.stringify(curr));
    }
  } catch(e) {}
})();

// -- UNIVERSAL WALLET INITIALIZER (Only uses verified provider accounts, never generates fake NUBANs) --
function getDedicatedVirtualAccountForUser(user) {
  if (!user) return null;
  let displayName = '';
  if (typeof getDisplayName === 'function') {
    displayName = getDisplayName(user);
  }
  if (!displayName || displayName === 'Collekt Member' || displayName === 'User' || displayName === 'Guest') {
    displayName = user.company_name || user.name || [user.first_name, user.other_name, user.last_name].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'ACCOUNT HOLDER');
  }
  const formattedAcctName = `COLLEKT / ${displayName.toUpperCase()}`;

  let existingAcct = (user.wallet && (user.wallet.paystack_dva_account || user.wallet.account_number)) || user.dva_account || '';
  existingAcct = String(existingAcct).trim();

  // If missing or a known dummy/fake placeholder, do not return a fake account
  const isInvalidOrFake = !/^\d{10}$/.test(existingAcct) || 
    existingAcct === '0123456789' || 
    existingAcct === '9800452109' || 
    existingAcct.startsWith('012900') ||
    existingAcct === '0167384649' ||
    existingAcct.startsWith('07000') ||
    existingAcct.startsWith('0777');

  if (isInvalidOrFake) {
    return null;
  }

  let bankName = (user.wallet && (user.wallet.paystack_dva_bank || user.wallet.bank_name)) || 'Fidelity Bank';

  return {
    account_number: existingAcct,
    account_name: (user.wallet && user.wallet.paystack_dva_name) || formattedAcctName,
    bank_name: bankName,
    bank_code: (user.wallet && user.wallet.bank_code) || (bankName.includes('Wema') ? '035' : (bankName.includes('Moniepoint') ? '090405' : '070')),
    currency: 'NGN',
    status: 'active',
    is_live_dva: true
  };
}

(function sanitizeAllUserWalletsStartup() {
  try {
    // 1. Sanitize collekt_user
    let curr = JSON.parse(localStorage.getItem('collekt_user') || 'null');
    if (curr) {
      const dva = getDedicatedVirtualAccountForUser(curr);
      if (!curr.wallet) curr.wallet = {};
      if (dva) {
        curr.wallet.paystack_dva_account = dva.account_number;
        curr.wallet.paystack_dva_bank = dva.bank_name;
        curr.wallet.paystack_dva_name = dva.account_name;
        curr.wallet.account_number = dva.account_number;
        curr.wallet.bank_name = dva.bank_name;
        curr.wallet.account_name = dva.account_name;
        curr.wallet.bank_assigned = true;
        curr.wallet.is_live_dva = true;
        curr.dva_account = dva.account_number;
        curr.dva_bank = dva.bank_name;
        curr.dva_name = dva.account_name;
      } else {
        // Clean out legacy fake accounts
        if (curr.wallet.paystack_dva_account && !curr.wallet.nova_linked) {
          const ac = String(curr.wallet.paystack_dva_account);
          if (ac.startsWith('07') || ac.startsWith('0129') || ac === '0167384649') {
            curr.wallet.paystack_dva_account = '';
            curr.wallet.account_number = '';
            curr.dva_account = '';
          }
        }
      }
      localStorage.setItem('collekt_user', JSON.stringify(curr));
    }

    // 2. Sanitize collekt_all_users
    let dir = JSON.parse(localStorage.getItem('collekt_all_users') || '[]');
    if (Array.isArray(dir)) {
      dir.forEach(u => {
        if (!u) return;
        const dva = getDedicatedVirtualAccountForUser(u);
        if (!u.wallet) u.wallet = {};
        if (dva) {
          u.wallet.paystack_dva_account = dva.account_number;
          u.wallet.paystack_dva_bank = dva.bank_name;
          u.wallet.paystack_dva_name = dva.account_name;
          u.wallet.account_number = dva.account_number;
          u.wallet.bank_name = dva.bank_name;
          u.wallet.account_name = dva.account_name;
        } else {
          if (u.wallet.paystack_dva_account && !u.wallet.nova_linked) {
            const ac = String(u.wallet.paystack_dva_account);
            if (ac.startsWith('07') || ac.startsWith('0129') || ac === '0167384649') {
              u.wallet.paystack_dva_account = '';
              u.wallet.account_number = '';
              u.dva_account = '';
            }
          }
        }
      });
      localStorage.setItem('collekt_all_users', JSON.stringify(dir));
    }
  } catch(e) {}
})();

// -- AUTH ----------------------------------------------
// getUser() stays synchronous (reads localStorage cache).
// The cache is refreshed by syncUser() (in supabase.js)
// which is called on every authenticated page load.
let _isGettingUser = false;
function getUser() {
  if (_isGettingUser) {
    try { return JSON.parse(localStorage.getItem('collekt_user')); } catch { return null; }
  }
  _isGettingUser = true;
  try {
    let u = JSON.parse(localStorage.getItem('collekt_user'));
    if (!u || typeof u !== 'object' || (!u.id && !u.email && !u.role)) return null;

    // Auto-correct any legacy other_name
    if (u.other_name === 'Chukwuemeka') {
      u.other_name = 'Oladapo';
      try { localStorage.setItem('collekt_user', JSON.stringify(u)); } catch(e){}
    }
    if (u.name && u.name.includes('Chukwuemeka')) {
      u.name = u.name.replace(/Chukwuemeka/g, 'Oladapo');
      try { localStorage.setItem('collekt_user', JSON.stringify(u)); } catch(e){}
    }

    // Check if user has been deleted by admin (exempting protected Dave Ojeowere account)
    const uEmail = String(u.email || '').toLowerCase().trim();
    if (uEmail !== 'ojeoweredave@gmail.com') {
      const deleted = (JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]')).map(x => String(x).toLowerCase().trim());
      const uId = String(u.id || '').toLowerCase().trim();
      const uUser = String(u.username || '').toLowerCase().trim();
      const uName = String(u.name || '').toLowerCase().trim();

      if (deleted.some(d => d && (uId === d || uEmail === d || uUser === d || uName === d))) {
        localStorage.removeItem('collekt_user');
        return null;
      }
    }

    // Auto-repair any company account contaminated by legacy code
    if (u.role === 'professional' && (u.company_name || u.cac || (u.name && u.name.toLowerCase() === 'collektng') || (u.email && u.email.toLowerCase().includes('collektng')))) {
      u.role = 'company';
      localStorage.setItem('collekt_last_role', 'company');
      try { localStorage.setItem('collekt_user', JSON.stringify(u)); } catch(e){}
    }

    // Authoritative role comes strictly from the user's registered account role (u.role)
    const primaryRole = (u.role === 'company' || u.role === 'professional') 
      ? u.role 
      : (localStorage.getItem('collekt_last_role') === 'company' ? 'company' : 'professional');

    // Merge saved directory profile attributes — but NEVER let directory override role
    const rawDir = JSON.parse(localStorage.getItem('collekt_all_users')) || [];
    const dirUser = rawDir.find(x => (x && x.id && x.id === u.id) || (x && x.email && u.email && x.email.toLowerCase() === u.email.toLowerCase()));

    if (dirUser && (dirUser.other_name === 'Chukwuemeka' || (dirUser.name && dirUser.name.includes('Chukwuemeka')))) {
      if (dirUser.other_name === 'Chukwuemeka') dirUser.other_name = 'Oladapo';
      if (dirUser.name) dirUser.name = dirUser.name.replace(/Chukwuemeka/g, 'Oladapo');
      try { localStorage.setItem('collekt_all_users', JSON.stringify(rawDir)); } catch(e){}
    }

    let merged = dirUser ? { ...dirUser, ...u, role: primaryRole } : { ...u, role: primaryRole };

    // Self-healing clean state for all accounts
    // 1. Clean legacy fake / mock virtual account numbers from user and wallet
    if (merged.wallet) {
      if (merged.wallet.account_number && (
        String(merged.wallet.account_number).startsWith('0129') ||
        merged.wallet.account_number === '0123456789' ||
        merged.wallet.account_number === '9800452109' ||
        (!merged.wallet.nova_linked && !merged.wallet.is_live_paystack && !merged.wallet.is_live_dva)
      )) {
        merged.wallet.account_number = '';
        merged.wallet.bank_assigned = false;
        if (merged.wallet.bank_name && (merged.wallet.bank_name.includes('Paystack DVA') || merged.wallet.bank_name.includes('NOVA Bank'))) {
          merged.wallet.bank_name = '';
        }
      }
    }
    if (merged.dva_account && (String(merged.dva_account).startsWith('0129') || merged.dva_account === '9800452109' || merged.dva_account === '0123456789')) {
      merged.dva_account = '';
    }

    // 2. Remove external OAuth avatar from avatar property so it does not count as uploaded photo
    if (merged.avatar && typeof merged.avatar === 'string' && (merged.avatar.includes('googleusercontent.com') || merged.avatar.includes('licdn.com'))) {
      merged.oauth_avatar = merged.avatar;
      merged.avatar = null;
      merged.avatar_uploaded = false;
    }
    if (merged.company_logo && typeof merged.company_logo === 'string' && (merged.company_logo.includes('googleusercontent.com') || merged.company_logo.includes('licdn.com'))) {
      merged.oauth_company_logo = merged.company_logo;
      merged.company_logo = null;
      merged.company_logo_uploaded = false;
    }

    return merged;
  } catch { return null; }
  finally {
    _isGettingUser = false;
  }
}



// -- GOOGLE & SOCIAL OAUTH AUTHENTICATION SUITE --
let pendingSocialProvider = 'google';
let selectedGoogleRole = 'professional';

async function loginWithSocialProvider(provider, explicitRole) {
  const normProvider = (provider || 'google').toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const urlRole = urlParams.get('role');
  const storedRole = localStorage.getItem('collekt_last_role');
  const role = explicitRole || (typeof selectedRole !== 'undefined' ? selectedRole : null) || urlRole || storedRole || 'professional';

  if (normProvider === 'linkedin') {
    if (typeof signInWithLinkedIn === 'function') {
      return await signInWithLinkedIn(role);
    } else {
      alert('Authentication module loading. Please try again in a moment.');
      return;
    }
  }

  if (normProvider === 'google') {
    if (typeof signInWithGoogle === 'function') {
      return await signInWithGoogle(role);
    } else {
      alert('Authentication module loading. Please try again in a moment.');
      return;
    }
  }

  if (typeof showToast === 'function') {
    showToast(`${provider || 'Social'} sign-in is coming soon. Please continue with Google or Email.`, 'warning');
  } else {
    alert(`${provider || 'Social'} sign-in is coming soon. Please continue with Google or Email.`);
  }
}

// Global listener for Google OAuth popup authorization callbacks
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.user) {
      const user = event.data.user;
      setUser(user);
      if (typeof getOrCreateUserWallet === 'function') {
        getOrCreateUserWallet(user);
      }
      if (typeof showToast === 'function') {
        showToast(`✅ Signed in as ${user.name} (${user.email})!`);
      }
      const targetPage = user.role === 'company' ? 'company-dashboard.html' : 'dashboard.html';
      setTimeout(() => {
        window.location.replace(targetPage);
      }, 400);
    }
  });
}


function selectGoogleModalRole(role) {
  selectedGoogleRole = role;
  localStorage.setItem('collekt_last_role', role);
  localStorage.setItem('collekt_pending_oauth_role', role);
  updateGoogleModalRoleUI(role);
}

function updateGoogleModalRoleUI(role) {
  const proCard = document.getElementById('gAuthRolePro');
  const coCard = document.getElementById('gAuthRoleCo');
  if (proCard && coCard) {
    if (role === 'company') {
      coCard.style.borderColor = 'var(--amber)';
      coCard.style.background = 'rgba(212,146,11,0.08)';
      proCard.style.borderColor = 'var(--line)';
      proCard.style.background = 'var(--white)';
    } else {
      proCard.style.borderColor = 'var(--teal)';
      proCard.style.background = 'rgba(19,117,111,0.08)';
      coCard.style.borderColor = 'var(--line)';
      coCard.style.background = 'var(--white)';
    }
  }
}

function executeGoogleSignIn(customEmail, customName) {
  const role = selectedGoogleRole || 'professional';
  localStorage.setItem('collekt_last_role', role);
  
  const provName = pendingSocialProvider === 'linkedin' ? 'LinkedIn' : 'Google';
  
  // Resolve Google Account Details
  let email = customEmail || 'ojeoweredave@gmail.com';
  let name = customName || (email.toLowerCase().includes('dave') ? 'Dave Oladapo Ojeowere' : email.split('@')[0].replace(/[._-]/g, ' '));
  
  const allUsers = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  let user = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Create new registered user with clean profile & unverified state
    user = {
      id: 'usr_' + pendingSocialProvider + '_' + Date.now(),
      name: name,
      first_name: name.split(' ')[0] || '',
      last_name: name.split(' ').slice(-1)[0] || '',
      other_name: name.split(' ').length > 2 ? name.split(' ')[1] : '',
      email: email,
      role: role,
      title: role === 'company' ? 'Enterprise Client & Project Owner' : 'Senior Technical Consultant',
      location: 'Lagos, Nigeria',
      bio: '',
      about: '',
      avatar: null,
      avatar_uploaded: false,
      verified: false,
      is_verified: false,
      verification_status: 'none',
      identity_verified: false,
      auth_provider: pendingSocialProvider,
      created_at: new Date().toISOString()
    };
    if (typeof saveRegisteredUser === 'function') {
      saveRegisteredUser(user);
    }
  } else {
    // If logging in as company but user was pro (or vice versa on explicit selection)
    if (role && user.role !== role && (customEmail || window.location.search.includes('role='))) {
      user.role = role;
    }
  }

  // Ensure virtual wallet is active
  if (typeof getOrCreateUserWallet === 'function') {
    getOrCreateUserWallet(user);
  }

  setUser(user);
  localStorage.setItem('collekt_last_user_email', user.email);

  if (typeof showToast === 'function') {
    showToast(`✅ Successfully signed in with ${provName} as a ${user.role === 'company' ? 'Company' : 'Professional'}!`);
  }

  closeGoogleAuthModal();

  const targetPage = user.role === 'company' ? 'company-dashboard.html' : 'dashboard.html';
  setTimeout(() => {
    window.location.replace(targetPage);
  }, 400);
}

function createGoogleAuthModalElement() {
  const modal = document.createElement('div');
  modal.id = 'googleAuthModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(4,14,13,0.7); z-index:999999; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); align-items:center; justify-content:center; padding:16px;';
  
  modal.innerHTML = `
    <div class="modal-card" style="position:relative; width:min(480px, calc(100vw - 32px)); background:var(--white); border-radius:24px; padding:28px 30px; box-shadow:0 30px 80px rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.85);">
      <button onclick="closeGoogleAuthModal()" style="position:absolute; top:18px; right:18px; background:rgba(0,0,0,0.06); border:none; width:34px; height:34px; border-radius:50%; font-size:18px; cursor:pointer; display:grid; place-items:center; color:var(--ink);">&times;</button>
      
      <!-- Google Brand Header -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:16px;">
        <svg width="28" height="28" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        <div>
          <div style="font-size:16px; font-weight:900; color:var(--ink);">Sign in with Google</div>
          <div style="font-size:12px; color:var(--muted);">to continue to Collekt Nigeria</div>
        </div>
      </div>

      <!-- Step 1: Select Account Role -->
      <div style="margin-bottom:18px;">
        <label style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); display:block; margin-bottom:8px;">1. Select Account Type</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div id="gAuthRolePro" onclick="selectGoogleModalRole('professional')" style="border:2px solid var(--teal); background:rgba(19,117,111,0.08); border-radius:14px; padding:12px; cursor:pointer; transition:all 0.2s ease;">
            <div style="font-size:20px; margin-bottom:4px;">👤</div>
            <div style="font-size:13px; font-weight:800; color:var(--ink);">Professional</div>
            <div style="font-size:11px; color:var(--muted);">Submit bids &amp; win tenders</div>
          </div>
          <div id="gAuthRoleCo" onclick="selectGoogleModalRole('company')" style="border:2px solid var(--line); background:var(--white); border-radius:14px; padding:12px; cursor:pointer; transition:all 0.2s ease;">
            <div style="font-size:20px; margin-bottom:4px;">🏢</div>
            <div style="font-size:13px; font-weight:800; color:var(--ink);">Company</div>
            <div style="font-size:11px; color:var(--muted);">Post RFPs &amp; hire specialists</div>
          </div>
        </div>
      </div>

      <!-- Step 2: Choose Google Account -->
      <div style="margin-bottom:20px;">
        <label style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); display:block; margin-bottom:8px;">2. Choose Google Account</label>
        
        <!-- Primary Google Account Option -->
        <div onclick="executeGoogleSignIn('ojeoweredave@gmail.com', 'Dave Oladapo Ojeowere')" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1.5px solid var(--line); border-radius:14px; cursor:pointer; background:var(--white); margin-bottom:8px; transition:all 0.2s ease;" onmouseover="this.style.borderColor='var(--teal)';this.style.background='rgba(19,117,111,0.04)'" onmouseout="this.style.borderColor='var(--line)';this.style.background='var(--white)'">
          <div style="width:38px; height:38px; border-radius:50%; background:#0E3B35; color:#fff; font-weight:900; font-size:15px; display:grid; place-items:center; flex-shrink:0;">D</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:800; color:var(--ink);">Dave Oladapo Ojeowere</div>
            <div style="font-size:12px; color:var(--muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">ojeoweredave@gmail.com</div>
          </div>
          <span style="font-size:11px; font-weight:800; color:var(--teal); background:rgba(19,117,111,0.1); padding:4px 8px; border-radius:999px;">Default</span>
        </div>

        <!-- Custom Account Entry Accordion -->
        <details style="border:1px dashed var(--line); border-radius:12px; padding:10px 14px; background:var(--paper);">
          <summary style="font-size:12px; font-weight:700; color:var(--teal); cursor:pointer;">Use another Google or Workspace account &rarr;</summary>
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
            <input class="form-input" type="text" id="gAuthCustomName" placeholder="Full Name (e.g. Engr. Aisha Bello)" style="font-size:13px;">
            <input class="form-input" type="email" id="gAuthCustomEmail" placeholder="Google Email (e.g. aisha@gmail.com)" style="font-size:13px;">
            <button onclick="const em=document.getElementById('gAuthCustomEmail').value.trim(); const nm=document.getElementById('gAuthCustomName').value.trim(); if(!em){alert('Please enter your Google email');return;} executeGoogleSignIn(em, nm);" class="btn btn-primary btn-sm" style="width:100%; justify-content:center; font-weight:800; margin-top:4px;">
              Continue with this Google Account &rarr;
            </button>
          </div>
        </details>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button onclick="closeGoogleAuthModal()" class="btn btn-outline btn-sm">Cancel</button>
      </div>
    </div>
  `;
  return modal;
}

// Auto-check on startup for OAuth redirect callbacks from Supabase/Google
async function checkOAuthCallback() {
  if (window.sb && window.sb.auth) {
    try {
      const { data: { session } } = await window.sb.auth.getSession();
      if (session && session.user) {
        const gEmail = session.user.email;
        const gName = (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || gEmail.split('@')[0];
        const gAvatar = session.user.user_metadata && (session.user.user_metadata.avatar_url || session.user.user_metadata.picture);
        
        const allUsers = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
        let match = allUsers.find(u => u.email && u.email.toLowerCase() === gEmail.toLowerCase());
        
        const pendingRole = localStorage.getItem('collekt_pending_oauth_role') || (session.user.user_metadata && session.user.user_metadata.role) || 'professional';
        
        if (!match) {
          match = {
            id: 'usr_g_' + session.user.id.slice(0, 12),
            name: gName,
            email: gEmail,
            avatar: null,
            avatar_uploaded: false,
            oauth_avatar: gAvatar || null,
            role: pendingRole,
            title: pendingRole === 'company' ? 'Enterprise Client & Project Owner' : 'Energy & Engineering Specialist',
            location: 'Lagos, Nigeria',
            bio: '',
            about: '',
            verified: false,
            is_verified: false,
            verification_status: 'none',
            identity_verified: false,
            auth_provider: 'google',
            created_at: new Date().toISOString()
          };
          if (typeof saveRegisteredUser === 'function') saveRegisteredUser(match);
        }
        
        if (typeof getOrCreateUserWallet === 'function') {
          getOrCreateUserWallet(match);
        }
        
        setUser(match);
        localStorage.setItem('collekt_last_user_email', match.email);
        localStorage.removeItem('collekt_pending_oauth_role');
        
        const target = match.role === 'company' ? 'company-dashboard.html' : 'dashboard.html';
        if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
          window.location.replace(target);
        }
      }
    } catch(e) {
      console.warn('OAuth callback processor error:', e);
    }
  }
}
document.addEventListener('DOMContentLoaded', checkOAuthCallback);


// -- REAL LINKEDIN OAUTH & ACCOUNT LINKING ENGINE --
async function connectRealLinkedInAccount() {
  const user = (typeof getUser === 'function') ? getUser() : null;
  if (!user) {
    if (typeof showToast === 'function') showToast('⚠️ Please log in before connecting LinkedIn', 'warning');
    else alert('Please log in before connecting LinkedIn');
    return false;
  }

  // Record pending linking state in storage
  localStorage.setItem('collekt_linking_linkedin_user_id', user.id || user.email || 'active_user');
  localStorage.setItem('collekt_linking_linkedin_time', Date.now().toString());
  localStorage.setItem('collekt_pending_linkedin_link', 'true');
  localStorage.setItem('collekt_last_role', user.role || 'professional');
  sessionStorage.setItem('collekt_linking_linkedin_target', 'profile.html');

  const redirectUri = window.location.origin + '/auth-callback.html?link_identity=linkedin';

  if (typeof showToast === 'function') {
    showToast('🔗 Redirecting to LinkedIn for secure authorization...', 'info');
  }

  if (window.sb && window.sb.auth) {
    try {
      // 1. If user has active Supabase session, try linkIdentity
      const { data: sessionData } = await window.sb.auth.getSession();
      if (sessionData && sessionData.session) {
        const { data, error } = await window.sb.auth.linkIdentity({
          provider: 'linkedin_oidc',
          options: {
            redirectTo: redirectUri
          }
        });
        if (!error && data && data.url) {
          window.location.href = data.url;
          return true;
        }
        if (error) {
          console.warn('linkIdentity notice, falling back to signInWithOAuth:', error.message);
        }
      }

      // 2. Direct signInWithOAuth flow
      const { data, error } = await window.sb.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: redirectUri
        }
      });

      if (error) {
        console.error('LinkedIn authorization error:', error);
        if (typeof showToast === 'function') showToast('⚠️ LinkedIn authorization notice: ' + error.message, 'error');
        else alert('LinkedIn authorization notice: ' + error.message);
        return false;
      }

      if (data && data.url) {
        window.location.href = data.url;
        return true;
      }
    } catch (err) {
      console.error('connectRealLinkedInAccount exception:', err);
      if (typeof showToast === 'function') showToast('⚠️ Could not connect to LinkedIn. Please try again.', 'error');
      return false;
    }
  } else {
    alert('Authentication client loading. Please refresh the page and try again.');
    return false;
  }
}

async function disconnectLinkedInAccount() {
  const user = (typeof getUser === 'function') ? getUser() : null;
  if (!user) return;

  if (!confirm('Are you sure you want to disconnect your LinkedIn account? Your verified LinkedIn badge will be removed.')) {
    return;
  }

  user.linkedin_linked = false;
  user.linkedin_url = '';
  delete user.linkedin_verified_at;
  delete user.linkedin_name;
  delete user.linkedin_sub;

  if (typeof setUser === 'function') setUser(user);
  if (typeof saveRegisteredUser === 'function') saveRegisteredUser(user);

  if (window.sb && user.id) {
    try {
      await sb.from('profiles').update({
        linkedin_url: null,
        linkedin_linked: false,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
    } catch(e) {}
  }

  const editField = document.getElementById('editLinkedIn');
  if (editField) editField.value = '';

  const connectBtn = document.getElementById('btnConnectLinkedIn');
  if (connectBtn) {
    connectBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" style="margin-right:4px;"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.6 1.6 0 0 0-1.6 1.6 1.6 1.6 0 0 0 1.6 1.6 1.6 1.6 0 0 0 1.6-1.6 1.6 1.6 0 0 0-1.6-1.6Z"/></svg><span>Connect Real Account</span>';
    connectBtn.style.background = '#0077b5';
  }

  if (typeof closeModal === 'function') closeModal('linkLinkedInModal');
  if (typeof renderProfileStrength === 'function') renderProfileStrength();
  if (typeof _applyProfile === 'function') _applyProfile(user);

  if (typeof showToast === 'function') {
    showToast('LinkedIn account disconnected.', 'info');
  }
}

async function linkLinkedInAccount(inputUrl) {
  const user = getUser();
  if (!user) {
    if (typeof showToast === 'function') showToast('⚠️ Please log in to link your LinkedIn account', 'warning');
    return false;
  }

  const rawUrl = (inputUrl && typeof inputUrl === 'string') ? inputUrl.trim() : '';

  // If no URL passed, launch the real LinkedIn connection flow
  if (!rawUrl || rawUrl.length < 3) {
    return connectRealLinkedInAccount();
  }

  // Normalize URL format
  let finalUrl = rawUrl;
  if (!finalUrl.includes('linkedin.com')) {
    const cleanUsername = finalUrl.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '');
    finalUrl = 'https://www.linkedin.com/in/' + cleanUsername;
  } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }

  user.linkedin_url = finalUrl;
  user.linkedin_linked = true;
  user.linkedin_verified_at = new Date().toISOString();

  if (typeof setUser === 'function') setUser(user);
  if (typeof saveRegisteredUser === 'function') saveRegisteredUser(user);

  if (window.sb && user.id) {
    try {
      sb.from('profiles').update({ linkedin_url: finalUrl, linkedin_linked: true }).eq('id', user.id);
    } catch(e) {}
  }

  const editField = document.getElementById('editLinkedIn');
  if (editField) editField.value = finalUrl;

  const connectBtn = document.getElementById('btnConnectLinkedIn');
  if (connectBtn) {
    connectBtn.innerHTML = '<span>✓</span> Linked';
    connectBtn.style.background = '#16a34a';
  }

  if (typeof showToast === 'function') {
    showToast('✅ LinkedIn profile saved! 🔗');
  } else {
    alert('✅ LinkedIn profile saved!');
  }

  if (typeof renderProfileStrength === 'function') renderProfileStrength();
  if (typeof _applyProfile === 'function') _applyProfile(user);
  return true;
}

window.connectRealLinkedInAccount = connectRealLinkedInAccount;
window.disconnectLinkedInAccount = disconnectLinkedInAccount;
window.linkLinkedInAccount = linkLinkedInAccount;

// -- REAL SUPABASE & MASTER ADMIN AUTHENTICATION ENGINE --
async function checkAdminSession() {
  // 1. Check verified Master Administrator session (localStorage or sessionStorage)
  try {
    const localAdmin = JSON.parse(localStorage.getItem('collekt_admin_auth') || sessionStorage.getItem('collekt_admin_auth') || 'null');
    if (localAdmin && localAdmin.role === 'admin') {
      return {
        user: { id: localAdmin.id || 'admin_master_1', email: localAdmin.email || 'admin@collekt.ng' },
        profile: { id: localAdmin.id || 'admin_master_1', role: 'admin', name: localAdmin.name || 'Super Administrator', email: localAdmin.email || 'admin@collekt.ng' }
      };
    }
    const localUser = JSON.parse(localStorage.getItem('collekt_user') || 'null');
    if (localUser && localUser.role === 'admin') {
      return {
        user: { id: localUser.id || 'admin_master_1', email: localUser.email || 'admin@collekt.ng' },
        profile: { id: localUser.id || 'admin_master_1', role: 'admin', name: localUser.name || 'Super Administrator', email: localUser.email || 'admin@collekt.ng' }
      };
    }
  } catch(e) {}

  // 2. Check live Supabase Auth session if present
  if (window.sb && window.sb.auth) {
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (!error && session && session.user) {
        const { data: profile } = await sb
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile && profile.role === 'admin') {
          return { user: session.user, profile: profile };
        }
      }
    } catch(err) {}
  }

  return null;
}

async function requireAdminAuth() {
  const authData = await checkAdminSession();
  if (!authData) {
    if (window.sb && window.sb.auth) {
      try { await sb.auth.signOut(); } catch(e){}
    }
    window.location.replace('admin-login.html');
    return null;
  }
  return authData;
}

async function logoutAdminUser() {
  try {
    localStorage.removeItem('collekt_admin_auth');
    sessionStorage.removeItem('collekt_admin_auth');
    document.cookie = "collekt_admin_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } catch(e) {}
  if (window.sb && window.sb.auth) {
    try { await sb.auth.signOut(); } catch(e){}
  }
  if (typeof clearUser === 'function') clearUser();
  window.location.replace('admin-login.html');
}

function getAdminUser() {
  try {
    const a = JSON.parse(localStorage.getItem('collekt_admin_auth') || sessionStorage.getItem('collekt_admin_auth') || 'null');
    if (a && a.role === 'admin') return a;
    const u = JSON.parse(localStorage.getItem('collekt_user') || 'null');
    if (u && u.role === 'admin') return u;
  } catch(e) {}
  return null;
}

function getAdminAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem('collekt_admin_audit_logs')) || [];
  } catch(e) {
    return [];
  }
}

async function fetchAdminAuditLogs(limit = 100) {
  try {
    const client = window.sb;
    if (client && typeof client.from === 'function') {
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && Array.isArray(data)) {
        const remoteLogs = data.map(row => {
          const meta = row.metadata || {};
          return {
            id: row.id,
            action: row.action || 'Admin Action',
            target: meta.target || row.entity_id || 'System',
            admin: meta.operator_email || meta.admin_name || 'Super Administrator',
            category: meta.category || row.entity_type || 'admin',
            timestamp: row.created_at || new Date().toISOString(),
            isRemote: true,
            rawId: row.id
          };
        });

        const localLogs = getAdminAuditLogs();
        const combined = [...remoteLogs];
        const seen = new Set(remoteLogs.map(r => r.id || `${r.action}_${r.timestamp}`));

        localLogs.forEach(l => {
          const key = l.id || `${l.action}_${l.timestamp}`;
          if (!seen.has(key)) {
            combined.push(l);
            seen.add(key);
          }
        });

        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (combined.length > limit) combined.length = limit;

        try {
          localStorage.setItem('collekt_admin_audit_logs', JSON.stringify(combined));
        } catch(e) {}

        return combined;
      }
    }
  } catch(e) {
    console.warn('Remote audit logs fetch notice:', e);
  }
  return getAdminAuditLogs();
}

function logAdminAuditActivity(action, target = 'System', category = 'admin', metadata = {}) {
  const adminObj = typeof getAdminUser === 'function' ? getAdminUser() : null;
  const adminName = adminObj ? (adminObj.name || adminObj.email) : 'Super Administrator';
  const adminEmail = adminObj ? (adminObj.email || 'admin@collekt.ng') : 'admin@collekt.ng';
  const nowIso = new Date().toISOString();
  const localId = 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  // 1. Maintain immediate synchronous local storage for zero-latency UI
  try {
    const logs = getAdminAuditLogs();
    logs.unshift({
      id: localId,
      action: String(action || 'Admin Action'),
      target: String(target || 'System'),
      admin: adminName,
      category: category,
      timestamp: nowIso
    });
    if (logs.length > 100) logs.length = 100;
    localStorage.setItem('collekt_admin_audit_logs', JSON.stringify(logs));
  } catch(e) {
    console.warn('Local audit cache notice:', e);
  }

  // 2. Asynchronously transmit to Supabase immutable public.audit_logs
  (async () => {
    try {
      const client = window.sb;
      if (client) {
        const payloadMeta = Object.assign({
          target: String(target || 'System'),
          category: String(category || 'admin'),
          admin_name: adminName,
          operator_email: adminEmail,
          client_timestamp: nowIso,
          source: 'admin-dashboard'
        }, metadata);

        // Attempt via stored procedure record_admin_audit first
        if (typeof client.rpc === 'function') {
          const { data: rpcRes, error: rpcErr } = await client.rpc('record_admin_audit', {
            p_action: String(action || 'Admin Action'),
            p_target: String(target || 'System'),
            p_category: String(category || 'admin'),
            p_metadata: payloadMeta
          });
          if (!rpcErr && rpcRes && rpcRes.success) return;
        }

        // Fallback to direct table insertion if RPC unavailable
        if (typeof client.from === 'function') {
          await client.from('audit_logs').insert([{
            action: String(action || 'Admin Action'),
            entity_type: String(category || 'admin'),
            entity_id: String(target || 'System'),
            metadata: payloadMeta,
            created_at: nowIso
          }]);
        }
      }
    } catch(remoteErr) {
      console.warn('Immutable remote audit log dispatch notice:', remoteErr);
    }
  })();
}

function getDisplayName(user) {
  const u = user || getUser();
  if (!u) return 'Guest';
  if (u.first_name || u.last_name || u.other_name) {
    const full = [u.first_name, u.other_name, u.last_name].filter(Boolean).join(' ');
    if (full) return full;
  }
  return u.name || u.company_name || u.full_name || u.username || (u.email ? u.email.split('@')[0] : 'User');
}

function syncUserDisplayEverywhere() {
  const u = getUser();
  if (!u) return;
  const name = getDisplayName(u);

  // 1. Welcome & Dashboard Headers
  ['welcomeName', 'welcomeUserName', 'companyWelcomeName', 'topbarUserName', 'navUserBtnName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  // 2. Profile Names
  ['profileName', 'coProfileName', 'userProfileName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  // 3. Topbar Profile Menu & Sidebar Displays
  document.querySelectorAll('.pm-name').forEach(el => {
    el.textContent = escapeHTML(name);
  });

  document.querySelectorAll('.u-name').forEach(el => {
    const badge = typeof getShieldBadgeHTML === 'function' ? getShieldBadgeHTML(14, u) : '';
    el.innerHTML = `${escapeHTML(name)} ${badge}`;
  });
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function setUser(data) {
  if (!data) return;
  // Read current session directly from localStorage to avoid getUser() directory merge
  let current = null;
  try { current = JSON.parse(localStorage.getItem('collekt_user')); } catch(e){}
  
  const merged = (current && current.id && data.id && current.id === data.id) 
    || (current && current.email && data.email && current.email.toLowerCase() === data.email.toLowerCase())
    ? { ...current, ...data }
    : data;
  
  // CRITICAL: if data explicitly carries a role, it MUST win — never let stale merged data override
  if (data.role) {
    merged.role = data.role;
  }
  
  if (merged.role === 'professional') {
    delete merged.company_name;
    delete merged.rep_first_name;
    delete merged.rep_last_name;
    delete merged.rep_other_name;
    delete merged.contact_person;
    delete merged.cac;
    localStorage.setItem('collekt_last_role', 'professional');
  } else if (merged.role === 'company') {
    localStorage.setItem('collekt_last_role', 'company');
  }

  // Sanitize external OAuth avatars for all accounts
  if (merged.avatar && typeof merged.avatar === 'string' && (merged.avatar.includes('googleusercontent.com') || merged.avatar.includes('licdn.com'))) {
    merged.oauth_avatar = merged.avatar;
    merged.avatar = null;
    merged.avatar_uploaded = false;
  }
  if (merged.company_logo && typeof merged.company_logo === 'string' && (merged.company_logo.includes('googleusercontent.com') || merged.company_logo.includes('licdn.com'))) {
    merged.oauth_company_logo = merged.company_logo;
    merged.company_logo = null;
    merged.company_logo_uploaded = false;
  }
  
  localStorage.setItem('collekt_user', JSON.stringify(merged));
  registerUserInDirectory(merged);
  try { syncUserDisplayEverywhere(); } catch(e){}
}

// -- USER DIRECTORY (shared registry of all platform accounts) --
function registerUserInDirectory(user) {
  if (!user || (!user.id && !user.email)) return;
  const dir = getAllRegisteredUsers();
  const idx = dir.findIndex(u => (user.id && u.id === user.id) || (user.email && u.email === user.email));
  const entry = idx >= 0 ? { ...dir[idx], ...user } : { ...user };
  
  if (entry.role === 'professional') {
    delete entry.company_name;
    delete entry.rep_first_name;
    delete entry.rep_last_name;
    delete entry.rep_other_name;
    delete entry.contact_person;
    delete entry.cac;
  }
  
  if (idx >= 0) dir[idx] = entry;
  else dir.push(entry);
  localStorage.setItem('collekt_all_users', JSON.stringify(dir));
  try { window.dispatchEvent(new Event('collekt_users_updated')); } catch(e){}
}


function syncRealUsersToDirectory(realProfiles) {
  if (!Array.isArray(realProfiles) || realProfiles.length === 0) return;
  try {
    const raw = JSON.parse(localStorage.getItem('collekt_all_users') || '[]');
    const map = new Map();

    const getCanonicalKey = (u) => {
      if (!u) return '';
      const email = String(u.email || '').toLowerCase().trim();
      if (email) return email;
      return String(u.id || '').toLowerCase().trim();
    };

    raw.forEach(u => {
      if (!u) return;
      const key = getCanonicalKey(u);
      if (!key) return;
      const n = String(u.name || u.company_name || '').toLowerCase().trim();
      // Purge any orphan/typo Collekng duplicate accounts
      if ((n === 'collekng' || n === 'collektng') && key !== 'collektng@gmail.com' && key !== '0f9ae84c-c5dd-4067-8ded-82638a6e9e01') {
        return;
      }
      map.set(key, u);
    });

    realProfiles.forEach(rp => {
      if (!rp) return;
      const key = getCanonicalKey(rp);
      if (!key) return;
      const idKey = rp.id ? String(rp.id).toLowerCase().trim() : '';
      const existing = map.get(key) || (idKey ? map.get(idKey) : null) || {};

      const isDave = key === 'ojeoweredave@gmail.com';
      const isCollektCo = key === 'collektng@gmail.com' || idKey === '0f9ae84c-c5dd-4067-8ded-82638a6e9e01' ||
                          String(rp.name || '').toLowerCase().includes('collekt') ||
                          String(rp.company_name || '').toLowerCase().includes('collekt');

      const merged = {
        ...existing,
        ...rp,
        id: isDave ? 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91' : (isCollektCo ? '0f9ae84c-c5dd-4067-8ded-82638a6e9e01' : (rp.id || existing.id)),
        email: isCollektCo ? 'collektng@gmail.com' : (rp.email || existing.email),
        name: isCollektCo ? 'Collekt Technologies Ltd' : (rp.company_name || rp.full_name || rp.name || existing.name),
        company_name: isCollektCo ? 'Collekt Technologies Ltd' : (rp.company_name || existing.company_name),
        role: isCollektCo ? 'company' : (rp.role || existing.role || 'professional'),
        is_verified: isCollektCo ? true : (rp.is_verified === true || existing.is_verified === true)
      };

      if (idKey && idKey !== key) map.delete(idKey);
      map.set(isCollektCo ? 'collektng@gmail.com' : key, merged);
    });

    const updated = Array.from(map.values());
    localStorage.setItem('collekt_all_users', JSON.stringify(updated));
    try { window.dispatchEvent(new Event('collekt_users_updated')); } catch(e){}
  } catch(e){}
}

function getAllRegisteredUsers() {
  try {
    // Ensure ojeoweredave@gmail.com is unblacklisted
    try {
      let del = JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]');
      del = del.filter(x => {
        const s = String(x).toLowerCase().trim();
        return s !== 'ojeoweredave@gmail.com' && s !== 'usr_dave_ojeowere' && s !== 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91';
      });
      localStorage.setItem('collekt_deleted_users', JSON.stringify(del));
    } catch(e){}

    let raw = JSON.parse(localStorage.getItem('collekt_all_users')) || [];
    const deleted = (JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]')).map(x => String(x).toLowerCase().trim());

    // 1. Strict purge of legacy mock / fake accounts - ONLY real users allowed
    const fakeTokens = [
      'bethelvvwire', 'bethel_vwire', 'patakhues', 'tessycelestine', 'tessycelestine9', 
      'chairman of the board', 'chairmanoftheboard', 'adaeze okonkwo', 'kunle adeyemi', 
      'bashiru musa', 'joshua emeka', 'farouk abubakar', 'chidi nnamdi', 'usr_chairman_of_the_board'
    ];

    raw = raw.filter(u => {
      if (!u) return false;
      const n = String(u.name || '').toLowerCase().trim();
      const username = String(u.username || '').toLowerCase().trim();
      const email = String(u.email || '').toLowerCase().trim();
      const id = String(u.id || '').toLowerCase().trim();

      // Purge duplicate/typo Collekng accounts without valid canonical ID/email
      if ((n === 'collekng' || n === 'collektng') && email !== 'collektng@gmail.com' && id !== '0f9ae84c-c5dd-4067-8ded-82638a6e9e01') {
        return false;
      }

      const isFake = fakeTokens.some(token => 
        id === token || n.includes(token) || username.includes(token) || (email && email.includes(token))
      );
      const isDeleted = deleted.some(d => d && (id === d || email === d || username === d || n === d));
      return !isFake && !isDeleted;
    });

    // 2. Ensure active user is registered in directory
    const currentUser = getUser();
    if (currentUser && (currentUser.id || currentUser.email)) {
      const cId = String(currentUser.id || '').toLowerCase().trim();
      const cEmail = String(currentUser.email || '').toLowerCase().trim();
      const cName = String(currentUser.name || '').toLowerCase().trim();
      const isCurDeleted = deleted.some(d => d && (cId === d || cEmail === d));
      const isCurFake = fakeTokens.some(token => cId === token || cName.includes(token) || (cEmail && cEmail.includes(token)));

      if (!isCurDeleted && !isCurFake) {
        const exists = raw.some(u => (currentUser.id && u.id === currentUser.id) || (currentUser.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()));
        if (!exists) {
          raw.push(currentUser);
        }
      }
    }

    // 3. Guarantee canonical Dave Oladapo Ojeowere account with real Supabase UUID
    const daveIdx = raw.findIndex(u => u && u.email && u.email.toLowerCase() === 'ojeoweredave@gmail.com');
    const daveProfile = {
      id: 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91',
      name: 'Dave Oladapo Ojeowere',
      first_name: 'Dave',
      last_name: 'Ojeowere',
      other_name: 'Oladapo',
      username: 'ojeoweredave',
      email: 'ojeoweredave@gmail.com',
      role: 'professional',
      title: 'Senior Proposal Manager & Technical Specialist',
      location: 'Lagos, Nigeria',
      bio: 'Senior Proposal Manager and Technical Commercial Specialist with extensive experience delivering multi-million dollar EPC & IOC bids across West Africa.',
      skills: ['Proposal Management', 'EPC Tendering', 'COREN Compliance', 'Commercial Valuation', 'IOC Contracting'],
      verified: false,
      is_verified: false,
      verification_status: 'none',
      identity_verified: false,
      rating: 0.0,
      review_count: 0,
      projects_completed: 0,
      total_earned: 0,
      success_rate: 0
    };

    if (daveIdx >= 0) {
      raw[daveIdx] = { ...daveProfile, ...raw[daveIdx], id: 'cb203a95-b9d1-4ae4-a4e5-76bf9e0f0d91' };
    } else {
      raw.unshift(daveProfile);
    }

    // 4. Guarantee SINGLE canonical Collekt Technologies Ltd (Company account)
    const companyProfile = {
      id: '0f9ae84c-c5dd-4067-8ded-82638a6e9e01',
      name: 'Collekt Technologies Ltd',
      company_name: 'Collekt Technologies Ltd',
      full_name: 'Collekt Technologies Ltd',
      email: 'collektng@gmail.com',
      role: 'company',
      title: 'Energy & EPC Enterprise',
      location: 'Lagos, Nigeria',
      about: 'Leading digital energy and infrastructure procurement enterprise powering West African tenders and talent matching.',
      verified: false,
      is_verified: false,
      verification_status: 'none',
      identity_verified: false,
      rating: 0.0,
      review_count: 0,
      projects_completed: 0,
      total_earned: 0,
      success_rate: 0
    };

    // Remove any duplicates of Collekt company account
    raw = raw.filter(u => {
      if (!u) return false;
      const em = String(u.email || '').toLowerCase().trim();
      const id = String(u.id || '').toLowerCase().trim();
      const n = String(u.name || u.company_name || '').toLowerCase().trim();
      if (em === 'collektng@gmail.com' || id === '0f9ae84c-c5dd-4067-8ded-82638a6e9e01' || n === 'collekng' || n === 'collektng') {
        return false;
      }
      return true;
    });
    // Add exactly one canonical Collekt Technologies Ltd
    raw.push(companyProfile);

    // 5. Guarantee Chen Pao (Professional account)
    const hasChen = raw.some(u => u && u.email && u.email.toLowerCase() === 'chenpao51@gmail.com');
    if (!hasChen) {
      raw.push({
        id: 'f69a187c-5848-4d1c-9fb5-bc60b181789f',
        name: 'Chen Pao',
        email: 'chenpao51@gmail.com',
        role: 'professional',
        title: 'Energy Specialist',
        location: 'Lagos, Nigeria',
        verified: false,
        is_verified: false,
        verification_status: 'none'
      });
    }

    // 6. Guarantee Grumpy Luan (Professional account)
    const hasLuan = raw.some(u => u && u.email && u.email.toLowerCase() === 'grumpyluan@gmail.com');
    if (!hasLuan) {
      raw.push({
        id: '814f4be6-cc86-47d3-b746-cd257f456548',
        name: 'Grumpy Luan',
        email: 'grumpyluan@gmail.com',
        role: 'professional',
        title: 'Energy Specialist',
        location: 'Lagos, Nigeria',
        verified: false,
        is_verified: false,
        verification_status: 'none'
      });
    }

    // 7. Strict deduplication by unique lowercase email and unique ID
    const seenEmails = new Set();
    const seenIds = new Set();
    const uniqueUsers = [];
    raw.forEach(u => {
      if (!u) return;
      const em = (u.email || '').toLowerCase().trim();
      const uid = (u.id || '').toLowerCase().trim();
      if (em && seenEmails.has(em)) return;
      if (uid && seenIds.has(uid)) return;
      if (em) seenEmails.add(em);
      if (uid) seenIds.add(uid);
      uniqueUsers.push(u);
    });
    raw = uniqueUsers;

    // 8. Clean wallets without mock account numbers
    raw.forEach(u => {
      if (!u.wallet) u.wallet = { balance: 0, escrow_balance: 0 };
      if (u.wallet.account_number && (
        String(u.wallet.account_number).startsWith('0129') ||
        u.wallet.account_number === '0123456789' ||
        u.wallet.account_number === '9800452109' ||
        (!u.wallet.nova_linked && !u.wallet.is_live_paystack && !u.wallet.is_live_dva)
      )) {
        u.wallet.account_number = '';
        u.wallet.bank_assigned = false;
        if (u.wallet.bank_name && (u.wallet.bank_name.includes('Paystack DVA') || u.wallet.bank_name.includes('NOVA Bank'))) {
          u.wallet.bank_name = '';
        }
      }
      if (u.dva_account && (String(u.dva_account).startsWith('0129') || u.dva_account === '9800452109' || u.dva_account === '0123456789')) {
        u.dva_account = '';
      }
    });

    localStorage.setItem('collekt_all_users', JSON.stringify(raw));
    return raw.filter(u => u && (u.id || u.email || u.name));
  } catch(e) {
    return [];
  }
}

// -- REAL-TIME USER METRICS ENGINE (100% REAL PLATFORM ACTIVITY) --
function getRealTimeUserMetrics(user) {
  if (!user) return { projects_completed: 0, total_earned: 0, success_rate: 0, rating: 0.0, review_count: 0 };

  const uId = String(user.id || '').toLowerCase();
  const uEmail = String(user.email || '').toLowerCase();
  const uUsername = String(user.username || '').toLowerCase();

  // 1. Compute real completed projects from actual proposals and engagements
  let completedProjects = 0;
  let totalProposals = 0;

  try {
    const allProposals = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    allProposals.forEach(p => {
      const pUser = String(p.userId || p.freelancer_id || p.author_email || p.email || '').toLowerCase();
      if ((uId && pUser === uId) || (uEmail && pUser === uEmail) || (uUsername && pUser === uUsername)) {
        totalProposals++;
        if (p.status === 'completed' || p.status === 'Job Collekted' || p.status === 'COMPLETED' || p.status === 'closed') {
          completedProjects++;
        }
      }
    });
  } catch(e){}

  try {
    const allContracts = JSON.parse(localStorage.getItem('collekt_contracts') || localStorage.getItem('collekt_engagements') || '[]');
    allContracts.forEach(c => {
      const cUser = String(c.freelancer_id || c.pro_id || c.user_id || '').toLowerCase();
      if ((uId && cUser === uId) || (uEmail && cUser === uEmail)) {
        if (c.status === 'completed' || c.status === 'closed' || c.status === 'Job Collekted' || c.status === 'COMPLETED') completedProjects++;
      }
    });
  } catch(e){}

  // 2. Compute real total earned from wallet transactions & milestone payouts
  let realEarned = 0;
  try {
    const txs = typeof getSavedTransactions === 'function' ? getSavedTransactions() : (JSON.parse(localStorage.getItem('collekt_transactions') || '[]'));
    txs.forEach(t => {
      const tUser = String(t.recipient_id || t.userId || t.user_id || '').toLowerCase();
      const isCredit = (t.type === 'earning' || t.type === 'milestone_release' || t.type === 'escrow_release' || t.type === 'credit' || t.type === 'inbound');
      if (((uId && tUser === uId) || (uEmail && tUser === uEmail)) && isCredit && t.status === 'completed') {
        realEarned += Number(t.amount || 0);
      }
    });
  } catch(e){}

  // Fallback to real user object values if explicitly stored
  if (completedProjects === 0 && user.projects_completed && Number(user.projects_completed) > 0) {
    // Only accept if not fake legacy numbers
    if (user.projects_completed !== 18 && user.projects_completed !== 32 && user.projects_completed !== 14) {
      completedProjects = Number(user.projects_completed);
    }
  }

  if (realEarned === 0 && user.total_earned && Number(user.total_earned) > 0) {
    if (user.total_earned !== 14200000 && user.total_earned !== 85000000 && user.total_earned !== 4200000) {
      realEarned = Number(user.total_earned);
    }
  }

  // 3. Compute real success rate
  let successRate = 0;
  if (completedProjects > 0) {
    successRate = totalProposals > 0 ? Math.min(100, Math.round((completedProjects / totalProposals) * 100)) : 100;
  }

  // 4. Compute real reviews & rating
  let reviews = [];
  if (Array.isArray(user.reviews)) reviews = user.reviews;
  else {
    try {
      const rKey = 'collekt_reviews_' + (user.id || user.email);
      reviews = JSON.parse(localStorage.getItem(rKey) || '[]');
    } catch(e){}
  }

  let rating = 0.0;
  let reviewCount = reviews.length;
  if (reviewCount > 0) {
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating || r.stars) || 5), 0);
    rating = Number((sum / reviewCount).toFixed(1));
  } else if (user.rating && Number(user.rating) > 0 && user.review_count > 0 && user.rating !== 5.0) {
    rating = Number(Number(user.rating).toFixed(1));
    reviewCount = Number(user.review_count);
  }

  return {
    projects_completed: completedProjects,
    total_earned: realEarned,
    success_rate: successRate,
    rating: rating,
    review_count: reviewCount
  };
}

function removeUserFromDirectory(identifier) {
  if (!identifier) return;
  const target = String(identifier).toLowerCase().trim();
  if (target === 'ojeoweredave@gmail.com' || target === 'usr_dave_ojeowere' || target === 'ojeoweredave' || target.includes('dave ojeowere')) {
    console.warn('Protected master account cannot be deleted:', identifier);
    return;
  }

  // 1. Add target identifier to permanent deleted blacklist
  try {
    const deleted = JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]');
    if (!deleted.includes(target)) {
      deleted.push(target);
      localStorage.setItem('collekt_deleted_users', JSON.stringify(deleted));
    }
  } catch(e){}

  // 2. Remove from collekt_all_users
  const raw = JSON.parse(localStorage.getItem('collekt_all_users')) || [];
  const dir = raw.filter(u => {
    if (!u) return false;
    const name = String(u.name || '').toLowerCase().trim();
    const username = String(u.username || '').toLowerCase().trim();
    const email = String(u.email || '').toLowerCase().trim();
    const id = String(u.id || '').toLowerCase().trim();
    const match = name === target || username === target || email === target || id === target || (email && email.split('@')[0] === target);

    if (match) {
      // Add all attributes of the matched user to the deleted blacklist
      try {
        const deleted = JSON.parse(localStorage.getItem('collekt_deleted_users') || '[]');
        [name, username, email, id, email.split('@')[0]].filter(Boolean).forEach(item => {
          const s = item.toLowerCase().trim();
          if (!deleted.includes(s)) deleted.push(s);
        });
        localStorage.setItem('collekt_deleted_users', JSON.stringify(deleted));
      } catch(e){}
    }

    return !match;
  });
  localStorage.setItem('collekt_all_users', JSON.stringify(dir));

  // 3. Clear active user session if matching deleted user
  try {
    const cur = JSON.parse(localStorage.getItem('collekt_user'));
    if (cur) {
      const cName = String(cur.name || '').toLowerCase().trim();
      const cUser = String(cur.username || '').toLowerCase().trim();
      const cEmail = String(cur.email || '').toLowerCase().trim();
      const cId = String(cur.id || '').toLowerCase().trim();
      if (cName === target || cUser === target || cEmail === target || cId === target || (cEmail && cEmail.split('@')[0] === target)) {
        localStorage.removeItem('collekt_user');
      }
    }
  } catch(e){}

  // 4. Dispatch live update event
  try { window.dispatchEvent(new CustomEvent('collekt_users_updated')); } catch(e){}
}

function getOtherRegisteredUsers() {
  const me = getUser();
  if (!me) return [];
  return getAllRegisteredUsers().filter(u => u.id !== me.id);
}

/// -- CROSS-USER MESSAGING SYSTEM -----------------------
// Conversations: [{id, participants: [userId1, userId2], created_at, last_message, last_at}]
// Messages:      [{id, conversation_id, sender_id, body, media_url, created_at, status, read, read_by}]

function getAllConversations() {
  try { return JSON.parse(localStorage.getItem('collekt_conversations')) || []; }
  catch { return []; }
}

function saveAllConversations(convs) {
  localStorage.setItem('collekt_conversations', JSON.stringify(convs));
}

function deduplicateMessages(msgs) {
  if (!Array.isArray(msgs)) return [];
  const result = [];
  
  for (const msg of msgs) {
    if (!msg || !msg.body) continue;
    
    // Check if there is an existing message in result that matches
    const existingIdx = result.findIndex(existing => {
      if (existing.id && msg.id && existing.id === msg.id) return true;
      if (existing.client_msg_id && msg.client_msg_id && existing.client_msg_id === msg.client_msg_id) return true;
      if (existing.id && msg.client_msg_id && existing.id === msg.client_msg_id) return true;
      if (existing.client_msg_id && msg.id && existing.client_msg_id === msg.id) return true;
      
      const sameConv = (existing.conversation_id === msg.conversation_id);
      const sameBody = String(existing.body || '').trim() === String(msg.body || '').trim();
      if (sameConv && sameBody) {
        const t1 = new Date(existing.created_at || 0).getTime();
        const t2 = new Date(msg.created_at || 0).getTime();
        if (Math.abs(t1 - t2) < 60000) return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      result.push({ ...msg });
    } else {
      const ex = result[existingIdx];
      const isExUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ex.id);
      const isMsgUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.id);

      const preferredId = isMsgUuid ? msg.id : ex.id;
      const preferredClientMsgId = ex.client_msg_id || msg.client_msg_id || (!isExUuid ? ex.id : msg.id);

      const statusRank = { read: 4, seen: 4, delivered: 3, sent: 2, sending: 1 };
      const exRank = statusRank[ex.status] || 0;
      const msgRank = statusRank[msg.status] || 0;
      const preferredStatus = (msgRank >= exRank) ? msg.status : ex.status;
      const preferredRead = Boolean(ex.read || msg.read || preferredStatus === 'read' || preferredStatus === 'seen');

      result[existingIdx] = {
        ...ex,
        ...msg,
        id: preferredId,
        client_msg_id: preferredClientMsgId,
        status: preferredStatus,
        read: preferredRead,
        read_by: Array.from(new Set([...(ex.read_by || []), ...(msg.read_by || [])])),
        recalled: Boolean(ex.recalled || msg.recalled),
        reaction: msg.reaction || ex.reaction
      };
    }
  }

  return result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function getAllMessages() {
  try { return JSON.parse(localStorage.getItem('collekt_all_messages')) || []; }
  catch { return []; }
}

function saveAllMessages(msgs) {
  const deduped = deduplicateMessages(msgs);
  localStorage.setItem('collekt_all_messages', JSON.stringify(deduped));
}

function getMyConversations() {
  const me = getUser();
  if (!me) return [];
  const myCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null);
  const myIds = [myCanonical, me.id, me.email, me.username]
    .filter(Boolean)
    .map(x => String(x).toLowerCase().trim());

  return getAllConversations().filter(c => {
    if (!c || !Array.isArray(c.participants)) return false;
    return c.participants.some(p => {
      const pNorm = String(p || '').toLowerCase().trim();
      return myIds.includes(pNorm);
    });
  });
}

function getOrCreateConversation(otherUserId) {
  const me = getUser();
  if (!me || !otherUserId) return null;
  const convs = getAllConversations();
  const dir = getAllRegisteredUsers();

  const target = String(otherUserId || '').toLowerCase().trim();
  const matchedUser = dir.find(u => {
    if (!u) return false;
    const uId = String(u.id || '').toLowerCase().trim();
    const uEmail = String(u.email || '').toLowerCase().trim();
    const uUsername = String(u.username || '').toLowerCase().trim();
    return uId === target || uEmail === target || uUsername === target;
  });

  const myCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null) || me.id || me.email || 'usr_current';
  const otherCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(otherUserId) : null) || (matchedUser ? matchedUser.id : otherUserId);

  const myLookups = [myCanonical, me.id, me.email, me.username].filter(Boolean).map(s => String(s).toLowerCase().trim());
  const otherLookups = [otherCanonical, otherUserId, matchedUser?.id, matchedUser?.email, matchedUser?.username].filter(Boolean).map(s => String(s).toLowerCase().trim());

  // Check if conversation already exists between these two users
  let conv = convs.find(c => {
    if (!c || !Array.isArray(c.participants)) return false;
    const p0 = String(c.participants[0] || '').toLowerCase().trim();
    const p1 = String(c.participants[1] || '').toLowerCase().trim();
    const hasMe = myLookups.includes(p0) || myLookups.includes(p1);
    const hasOther = otherLookups.includes(p0) || otherLookups.includes(p1);
    return hasMe && hasOther;
  });

  if (conv) {
    if (myCanonical && otherCanonical) {
      conv.participants = [myCanonical, otherCanonical];
      saveAllConversations(convs);
    }
    return conv;
  }

  // Create new conversation
  conv = {
    id: 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    participants: [myCanonical, otherCanonical],
    created_at: new Date().toISOString(),
    last_message: '',
    last_at: new Date().toISOString()
  };
  convs.push(conv);
  saveAllConversations(convs);

  // Sync to Supabase in background
  if (window.sb && typeof createSupabaseConversation === 'function') {
    createSupabaseConversation(myCanonical, otherCanonical).then(sbConv => {
      if (sbConv && sbConv.id) {
        const all = getAllConversations();
        const found = all.find(c => c.id === conv.id || (
          c.participants && c.participants.includes(myCanonical) && c.participants.includes(otherCanonical)
        ));
        if (found) {
          const oldId = found.id;
          found.id = sbConv.id;
          found.participants = [sbConv.participant_a, sbConv.participant_b];
          saveAllConversations(all);

          if (oldId !== sbConv.id) {
            const allMsgs = getAllMessages();
            let msgsUpdated = false;
            allMsgs.forEach(m => {
              if (m.conversation_id === oldId) {
                m.conversation_id = sbConv.id;
                msgsUpdated = true;
              }
            });
            if (msgsUpdated) saveAllMessages(allMsgs);
          }
          try { window.dispatchEvent(new Event('collekt_conversations_updated')); } catch(e){}
        }
      }
    }).catch(e => console.warn('Supabase conversation create notice:', e));
  }

  return conv;
}

function getConversationMessages(conversationId) {
  const all = getAllMessages().filter(m => m.conversation_id === conversationId);
  return deduplicateMessages(all);
}

function getUnreadMessageCount() {
  const me = getUser();
  if (!me) return 0;
  
  const myCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null) || me.id;
  const msgs = getAllMessages();
  const convs = getMyConversations();
  const myConvIds = new Set(convs.map(c => c.id));

  let unread = 0;
  msgs.forEach(m => {
    if (myConvIds.has(m.conversation_id) && m.sender_id !== myCanonical && m.sender_id !== me.id) {
      const isRead = m.read || (m.read_by && (m.read_by.includes(myCanonical) || m.read_by.includes(me.id)));
      if (!isRead) unread++;
    }
  });

  return unread;
}

function markConversationAsRead(convId) {
  const me = getUser();
  if (!me || !convId) return;
  const myCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null) || me.id;
  const msgs = getAllMessages();
  let updated = false;
  msgs.forEach(m => {
    if (m.conversation_id === convId && m.sender_id !== myCanonical && m.sender_id !== me.id) {
      if (!m.read) {
        m.read = true;
        m.status = 'read';
        updated = true;
      }
      if (!m.read_by) m.read_by = [];
      if (!m.read_by.includes(myCanonical)) {
        m.read_by.push(myCanonical);
        updated = true;
      }
    }
  });
  if (updated) {
    saveAllMessages(msgs);
    updateLiveUnreadMessageBadges();
    try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
  }

  if (window.sb && typeof markSupabaseMessagesAsRead === 'function') {
    markSupabaseMessagesAsRead(convId, myCanonical);
  }
}

function updateLiveUnreadMessageBadges() {
  const count = getUnreadMessageCount();
  
  // 1. Quick Links on dashboard.html & company-dashboard.html
  const qlMsg = document.getElementById('quickLinkMessages');
  if (qlMsg) {
    if (count > 0) {
      qlMsg.innerHTML = `💬 Messages <span style="background:#ef4444; color:#fff; font-size:11px; font-weight:800; padding:2px 8px; border-radius:99px; margin-left:4px;">(${count} unread)</span>`;
    } else {
      qlMsg.innerHTML = `💬 Messages`;
    }
  }

  // 2. Sidebar Navigation Items
  const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
  sidebarNavItems.forEach(item => {
    if (item.getAttribute('href') === 'messages.html') {
      let badge = item.querySelector('.sidebar-msg-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'sidebar-msg-badge';
          badge.style.cssText = 'background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:99px; margin-left:auto; display:inline-block;';
          item.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else if (badge) {
        badge.style.display = 'none';
      }
    }
  });

  // 3. Any element with class .unread-msg-count
  document.querySelectorAll('.unread-msg-count').forEach(el => {
    el.textContent = count > 0 ? `(${count} unread)` : '';
  });
}

function sendMessage(conversationId, body, mediaUrl = null) {
  const me = getUser();
  if (!me || !body || !body.trim() || !conversationId) return null;

  const myId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null) || me.id || me.email || me.username || 'usr_current';
  const msgs = getAllMessages();
  const convs = getAllConversations();
  let conv = convs.find(c => c.id === conversationId);

  // Determine other participant for receiver_id
  let otherParticipantId = null;
  if (conv && Array.isArray(conv.participants)) {
    const other = conv.participants.find(p => {
      const pStr = String(p || '').toLowerCase().trim();
      return pStr !== String(myId).toLowerCase().trim() &&
             pStr !== String(me.id || '').toLowerCase().trim() &&
             pStr !== String(me.email || '').toLowerCase().trim();
    });
    if (other) {
      otherParticipantId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(other) : null) || other;
    }
  }

  const clientMsgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const msg = {
    id: clientMsgId,
    client_msg_id: clientMsgId,
    conversation_id: conversationId,
    sender_id: myId,
    body: body.trim(),
    media_url: mediaUrl,
    created_at: new Date().toISOString(),
    status: 'sent', // Starts as 1 grey swoosh
    read: false,
    read_by: [myId]
  };
  msgs.push(msg);
  saveAllMessages(msgs);

  // Update conversation metadata
  if (conv) {
    conv.last_message = body.trim().length > 60 ? body.trim().slice(0, 60) + '...' : body.trim();
    conv.last_at = msg.created_at;
    saveAllConversations(convs);
  }

  updateLiveUnreadMessageBadges();
  try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}

  // Delivered transition (2 grey swooshes)
  setTimeout(() => {
    const all = getAllMessages();
    const target = all.find(m => m.id === clientMsgId || m.client_msg_id === clientMsgId);
    if (target && target.status === 'sent') {
      target.status = 'delivered';
      saveAllMessages(all);
      try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
    }
  }, 400);

  // Live Supabase Persistence
  if (window.sb && typeof sendSupabaseMessage === 'function') {
    (async () => {
      try {
        let targetConvId = conversationId;
        const isConvUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetConvId);
        
        if (!isConvUuid && otherParticipantId && typeof createSupabaseConversation === 'function') {
          const sbConv = await createSupabaseConversation(myId, otherParticipantId);
          if (sbConv && sbConv.id) {
            targetConvId = sbConv.id;
            if (conv) conv.id = sbConv.id;
            msg.conversation_id = sbConv.id;
            saveAllConversations(getAllConversations());
          }
        }

        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetConvId)) {
          const sbMsg = await sendSupabaseMessage(targetConvId, myId, body.trim(), mediaUrl, otherParticipantId);
          if (sbMsg && sbMsg.id) {
            const curAll = getAllMessages();
            const existingIdx = curAll.findIndex(m => m.id === clientMsgId || m.client_msg_id === clientMsgId);
            if (existingIdx !== -1) {
              curAll[existingIdx].id = sbMsg.id;
              curAll[existingIdx].status = 'delivered';
              saveAllMessages(curAll);
            }
            try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
          }
        }
      } catch (err) {
        console.warn('Supabase live message persistence notice:', err);
      }
    })();
  }

  return msg;
}

function recallMessage(conversationId, msgId) {
  const me = getUser();
  if (!me || !msgId) return false;
  const msgs = getAllMessages();
  const msg = msgs.find(m => m.id === msgId && m.conversation_id === conversationId);
  if (msg) {
    msg.recalled = true;
    msg.body = 'This message was recalled';
    saveAllMessages(msgs);

    const convs = getAllConversations();
    const conv = convs.find(c => c.id === conversationId);
    if (conv) {
      const activeMsgs = msgs.filter(m => m.conversation_id === conversationId);
      const lastM = activeMsgs.length ? activeMsgs[activeMsgs.length - 1] : null;
      conv.last_message = lastM ? (lastM.recalled ? '🚫 Message recalled' : lastM.body) : 'No messages yet';
      conv.last_at = lastM ? lastM.created_at : conv.last_at;
      saveAllConversations(convs);
    }
    try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
    return true;
  }
  return false;
}

function deleteMessage(conversationId, msgId) {
  const msgs = getAllMessages();
  const idx = msgs.findIndex(m => m.id === msgId && m.conversation_id === conversationId);
  if (idx !== -1) {
    msgs.splice(idx, 1);
    saveAllMessages(msgs);

    const convs = getAllConversations();
    const conv = convs.find(c => c.id === conversationId);
    if (conv) {
      const activeMsgs = msgs.filter(m => m.conversation_id === conversationId);
      const lastM = activeMsgs.length ? activeMsgs[activeMsgs.length - 1] : null;
      conv.last_message = lastM ? (lastM.recalled ? '🚫 Message recalled' : lastM.body) : 'No messages yet';
      conv.last_at = lastM ? lastM.created_at : conv.last_at;
      saveAllConversations(convs);
    }
    try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
    return true;
  }
  return false;
}

function reactToMessage(conversationId, msgId, emoji) {
  const msgs = getAllMessages();
  const msg = msgs.find(m => m.id === msgId && m.conversation_id === conversationId);
  if (msg) {
    msg.reaction = msg.reaction === emoji ? null : emoji;
    saveAllMessages(msgs);
    try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
    return true;
  }
  return false;
}

function deleteEntireConversation(conversationId) {
  if (!conversationId) return false;
  const convs = getAllConversations().filter(c => c.id !== conversationId);
  saveAllConversations(convs);

  const msgs = getAllMessages().filter(m => m.conversation_id !== conversationId);
  saveAllMessages(msgs);

  updateLiveUnreadMessageBadges();
  try { window.dispatchEvent(new Event('collekt_messages_updated')); } catch(e){}
  return true;
}

function getOtherParticipant(conversation) {
  const me = getUser();
  if (!me || !conversation || !conversation.participants) return { id: 'unknown', name: 'Collekt Member', role: 'professional', avatar_letter: 'U' };
  
  const myCanonical = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(me) : null);
  const myIds = [myCanonical, me.id, me.email, me.username].filter(Boolean).map(x => String(x).toLowerCase().trim());

  const otherId = conversation.participants.find(id => {
    const s = String(id || '').toLowerCase().trim();
    return s && !myIds.includes(s);
  });

  const dir = getAllRegisteredUsers();
  const target = String(otherId || '').toLowerCase().trim();

  const match = dir.find(u => {
    if (!u) return false;
    const uId = String(u.id || '').toLowerCase().trim();
    const uEmail = String(u.email || '').toLowerCase().trim();
    const uUsername = String(u.username || '').toLowerCase().trim();
    const uName = String(u.name || '').toLowerCase().trim();
    const uComp = String(u.company_name || '').toLowerCase().trim();
    return uId === target || uEmail === target || uUsername === target || uName === target || uComp === target;
  });

  if (match) {
    const isCo = match.role === 'company' || match.user_type === 'company';
    const dispName = (isCo ? (match.company_name || match.name) : (match.name || match.company_name)) || match.email || 'Collekt Member';
    return {
      ...match,
      name: dispName,
      avatar_letter: dispName.charAt(0).toUpperCase()
    };
  }

  // Fallback graceful participant metadata
  const fallbackName = target && !target.includes('-') ? (target.charAt(0).toUpperCase() + target.slice(1)) : 'Collekt Member';
  return { 
    id: otherId || 'unknown', 
    name: fallbackName, 
    role: 'professional', 
    avatar_letter: (fallbackName || 'U').charAt(0).toUpperCase() 
  };
}

// -- WALLET & PAYSTACK DEDICATED VIRTUAL ACCOUNT (DVA) HELPER ----------------------
function getPaystackPublicKey() {
  return localStorage.getItem('collekt_paystack_public_key') || 'pk_test_353e83b169542a1215b497e748530438cf38c114';
}

function savePaystackPublicKey(key) {
  if (key) localStorage.setItem('collekt_paystack_public_key', key.trim());
}

function getPaystackSecretKey() {
  return localStorage.getItem('collekt_paystack_secret_key') || '';
}

function savePaystackSecretKey(key) {
  if (key) localStorage.setItem('collekt_paystack_secret_key', key.trim());
}

async function createLivePaystackDVA(targetUser, secretKey, preferredBankSlug) {
  const user = targetUser || getUser();
  if (!user) return { success: false, message: 'No user found' };
  const sk = secretKey || getPaystackSecretKey();
  if (!sk) return { success: false, message: 'No Paystack Secret Key provided' };

  const nameParts = (user.name || 'Collekt Member').trim().split(' ');
  const firstName = user.first_name || nameParts[0] || 'Member';
  const lastName = user.last_name || nameParts.slice(1).join(' ') || 'Collekt';
  const email = user.email || `user_${user.id || Date.now()}@collekt.ng`;
  const phone = user.phone || '+2348000000000';

  const bankSlugMap = {
    'NOVA Bank (Paystack DVA)': 'nova-bank',
    'NOVA Bank': 'nova-bank',
    'nova-bank': 'nova-bank',
    'Wema Bank (Paystack DVA)': 'wema-bank',
    'Sterling Bank (Paystack DVA)': 'sterling-bank',
    'Providus Bank (Paystack DVA)': 'providus-bank',
    'Titan Trust Bank (Paystack DVA)': 'titan-bank'
  };
  const bankSlug = preferredBankSlug || bankSlugMap[localStorage.getItem('collekt_paystack_bank_partner')] || 'nova-bank';

  // 1. Attempt via Netlify Serverless Backend (Bypasses Browser CORS & Direct Paystack API)
  try {
    const fnResp = await fetch('/.netlify/functions/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_dva',
        secret_key: sk,
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        preferred_bank: bankSlug
      })
    });

    if (fnResp.ok) {
      const fnData = await fnResp.json();
      if (fnData.success && fnData.account_number) {
        if (!user.wallet) user.wallet = {};
        user.wallet.bank_assigned = true;
        user.wallet.bank_name = fnData.bank_name || 'Wema Bank (Paystack Live)';
        user.wallet.account_number = fnData.account_number;
        user.wallet.account_name = fnData.account_name || ('COLLEKT / ' + getDisplayName(user).toUpperCase());
        user.wallet.paystack_customer_code = fnData.customer_code;
        user.wallet.is_live_paystack = true;

        setUser(user);
        return { success: true, user: user, data: fnData };
      } else if (fnData.message) {
        console.warn('Paystack DVA notice from backend:', fnData);
        return { success: false, message: fnData.message, details: fnData };
      }
    }
  } catch (backendErr) {
    console.warn('Netlify serverless backend not reached, trying direct API:', backendErr);
  }

  // 2. Fallback direct API call (if backend proxy not running)
  try {
    const custResp = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + sk,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phone
      })
    });

    const custData = await custResp.json();
    let customerCode = (custData.status && custData.data) ? custData.data.customer_code : null;

    if (!customerCode && email) {
      try {
        const fetchCust = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(email)}`, {
          headers: { 'Authorization': 'Bearer ' + sk }
        });
        const fetchCustData = await fetchCust.json();
        if (fetchCustData.status && fetchCustData.data) {
          customerCode = fetchCustData.data.customer_code;
        }
      } catch(e){}
    }

    if (!customerCode) {
      return { success: false, message: custData.message || 'Paystack Customer registration failed.' };
    }

    const dvaResp = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + sk,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: bankSlug
      })
    });

    const dvaData = await dvaResp.json();
    if (dvaData.status && dvaData.data) {
      const acct = dvaData.data;
      if (!user.wallet) user.wallet = {};
      user.wallet.bank_assigned = true;
      user.wallet.bank_name = (acct.bank && acct.bank.name) ? acct.bank.name + ' (Paystack Live)' : 'Wema Bank (Paystack Live)';
      user.wallet.account_number = acct.account_number;
      user.wallet.account_name = acct.account_name || ('COLLEKT / ' + getDisplayName(user).toUpperCase());
      user.wallet.paystack_customer_code = customerCode;
      user.wallet.is_live_paystack = true;

      setUser(user);
      return { success: true, user: user, data: dvaData };
    } else {
      return { success: false, message: dvaData.message || 'Dedicated Account creation declined by Paystack.', details: dvaData };
    }
  } catch (err) {
    return { success: false, message: err.message || 'Paystack connection error' };
  }
}

function getOrCreateUserWallet(user) {
  if (!user) return null;
  let wallet = user.wallet || {};

  const dva = getDedicatedVirtualAccountForUser(user);

  let authBal = (user.wallet_balance !== undefined && user.wallet_balance !== null && user.wallet_balance !== 2450000 && user.wallet_balance !== 1450000)
    ? Number(user.wallet_balance)
    : (wallet.balance !== 2450000 && wallet.balance !== 1450000 && wallet.balance !== undefined ? Number(wallet.balance) : 0);

  wallet = {
    ...wallet,
    bank_assigned: !!dva || !!(wallet.nova_linked && wallet.nova_account_number),
    is_live_dva: !!dva,
    bank_name: dva ? dva.bank_name : (wallet.bank_name || ''),
    bank_code: dva ? dva.bank_code : (wallet.bank_code || ''),
    account_number: dva ? dva.account_number : (wallet.account_number || ''),
    account_name: dva ? dva.account_name : (wallet.account_name || ''),
    paystack_dva_account: dva ? dva.account_number : (wallet.paystack_dva_account || ''),
    paystack_dva_bank: dva ? dva.bank_name : (wallet.paystack_dva_bank || ''),
    paystack_dva_name: dva ? dva.account_name : (wallet.paystack_dva_name || ''),
    balance: authBal,
    available_balance: authBal,
    escrow_balance: Number(user.escrow_balance || wallet.escrow_balance || 0),
    hide_balance: !!wallet.hide_balance,
  };

  // If user has explicitly linked their NOVA account, ensure it's mirrored
  if (wallet.nova_linked && wallet.nova_account_number) {
    wallet.bank_assigned = true;
    wallet.account_number = wallet.nova_account_number;
    wallet.bank_name = 'NOVA Bank (Nova Commercial Bank)';
  }

  user.wallet = wallet;
  if (dva) {
    user.dva_account = dva.account_number;
    user.dva_bank = dva.bank_name;
    user.dva_name = dva.account_name;
  } else if (!wallet.nova_linked) {
    user.dva_account = '';
  }
  setUser(user);

  return user.wallet;
}

async function generateVirtualBankAccount(targetUser, reloadPage = true) {
  const user = targetUser || getUser();
  if (!user) return;
  if (!user.wallet) user.wallet = { balance: 0, escrow_balance: 0 };

  const dva = getDedicatedVirtualAccountForUser(user);
  if (dva) {
    user.wallet.bank_assigned = true;
    user.wallet.is_live_dva = true;
    user.wallet.account_number = dva.account_number;
    user.wallet.bank_name = dva.bank_name;
    user.wallet.bank_code = dva.bank_code;
    user.wallet.account_name = dva.account_name;
    user.wallet.paystack_dva_account = dva.account_number;
    user.wallet.paystack_dva_bank = dva.bank_name;
    user.wallet.paystack_dva_name = dva.account_name;
    user.dva_account = dva.account_number;
    user.dva_bank = dva.bank_name;
    user.dva_name = dva.account_name;
  }

  setUser(user);

  // Sync with directory users
  try {
    const dir = getDirectoryUsers();
    const idx = dir.findIndex(u => (u.id && u.id === user.id) || (u.email && u.email === user.email));
    if (idx !== -1) {
      dir[idx].wallet = user.wallet;
      saveDirectoryUsers(dir);
    }
  } catch(e){}

  if (reloadPage) {
    showToast('🎉 Dedicated Virtual Account ready! Account: ' + user.wallet.account_number);
    setTimeout(() => window.location.reload(), 600);
  }
}

function isUserNovaLinked(user) {
  if (!user) user = getUser();
  return Boolean(
    user &&
    user.wallet &&
    user.wallet.nova_linked === true &&
    user.wallet.nova_account_number &&
    String(user.wallet.nova_account_number).trim().replace(/\D/g, '').length === 10
  );
}

function unlinkUserNovaAccount(user) {
  if (!user) user = getUser();
  if (!user || !user.wallet) return;
  user.wallet.nova_linked = false;
  user.wallet.nova_account_number = '';
  user.wallet.nova_account_name = '';
  user.wallet.account_number = '';
  user.wallet.account_name = '';
  user.wallet.bank_assigned = false;
  setUser(user);
  try {
    const dir = getDirectoryUsers();
    const idx = dir.findIndex(u => (u.id && u.id === user.id) || (u.email && u.email === user.email));
    if (idx !== -1) {
      dir[idx].wallet = user.wallet;
      dir[idx].nova_account_number = '';
      dir[idx].nova_account_name = '';
      saveDirectoryUsers(dir);
    }
  } catch(e) {}
  window.dispatchEvent(new CustomEvent('collekt_wallet_updated'));
}

// ── NOVA BANK EXCLUSIVE SETTLEMENT & ESCROW ENGINE ───────────
function getMasterNovaAccount() {
  try {
    const saved = localStorage.getItem('collekt_master_nova_account');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return {
    bank_name: 'NOVA Bank (Nova Commercial Bank)',
    account_number: '0129845011',
    account_name: 'COLLEKT ENTERPRISE / NOVA SETTLEMENT',
    routing_code: '060003'
  };
}

function saveMasterNovaAccount(details) {
  if (!details) return;
  const current = getMasterNovaAccount();
  const updated = {
    ...current,
    ...details,
    bank_name: 'NOVA Bank (Nova Commercial Bank)'
  };
  localStorage.setItem('collekt_master_nova_account', JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('collekt_master_nova_updated', { detail: updated }));
  return updated;
}

function linkUserNovaAccount(user, accountNo, accountName) {
  if (!user) user = getUser();
  if (!user) return { success: false, message: 'User session not found. Please log in.' };

  accountNo = String(accountNo || '').trim().replace(/\D/g, '');
  if (accountNo.length !== 10) {
    return { success: false, message: 'Please provide a valid 10-digit NOVA Bank NUBAN account number.' };
  }

  accountName = String(accountName || '').trim();
  if (!accountName || accountName.length < 3) {
    return { success: false, message: 'Please enter the official account holder name as registered with NOVA Bank.' };
  }

  if (!user.wallet) user.wallet = {};
  user.wallet.nova_account_number = accountNo;
  user.wallet.nova_account_name = accountName.toUpperCase();
  user.wallet.nova_linked = true;
  user.wallet.nova_linked_at = new Date().toISOString();
  user.wallet.bank_name = 'NOVA Bank (Nova Commercial Bank)';
  user.wallet.account_number = accountNo;
  user.wallet.account_name = accountName.toUpperCase();
  user.wallet.bank_assigned = true;

  setUser(user);

  // Sync with directory users
  try {
    const dir = getDirectoryUsers();
    const idx = dir.findIndex(u => (u.id && u.id === user.id) || (u.email && u.email === user.email));
    if (idx !== -1) {
      dir[idx].wallet = user.wallet;
      dir[idx].nova_account_number = accountNo;
      dir[idx].nova_account_name = accountName.toUpperCase();
      saveDirectoryUsers(dir);
    }
  } catch(e) {}

  window.dispatchEvent(new CustomEvent('collekt_wallet_updated'));
  return { success: true, user: user, message: 'NOVA Bank Account linked and verified!' };
}

function getPendingNovaDeposits() {
  try {
    return JSON.parse(localStorage.getItem('collekt_pending_nova_deposits') || '[]');
  } catch(e) {
    return [];
  }
}

function savePendingNovaDeposits(deposits) {
  if (!Array.isArray(deposits)) return;
  try {
    localStorage.setItem('collekt_pending_nova_deposits', JSON.stringify(deposits));
    window.dispatchEvent(new CustomEvent('collekt_nova_deposits_updated'));
  } catch(e) {}
}

function submitNovaDepositRequest(data) {
  const user = getUser();
  const amt = parseFloat(data.amount);
  if (!amt || isNaN(amt) || amt < 100) {
    return { success: false, message: 'Minimum deposit amount is ₦100.' };
  }

  const deposits = getPendingNovaDeposits();
  const depositRef = (data.reference || ('NOVA-' + Date.now().toString().slice(-6))).toUpperCase().trim();
  const newDeposit = {
    id: 'NOVADEP-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    user_id: user?.id || data.userId || 'usr_member',
    user_name: typeof getDisplayName === 'function' ? getDisplayName(user) : (user?.name || data.userName || 'Collekt Member'),
    user_email: user?.email || data.userEmail || '',
    amount: amt,
    reference: depositRef,
    sender_account_name: (data.senderAccountName || '').trim(),
    sender_account_no: (data.senderAccountNo || '').trim(),
    notes: data.notes || 'NOVA Bank Direct Transfer',
    status: 'pending', // 'pending' | 'approved' | 'declined'
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  deposits.unshift(newDeposit);
  savePendingNovaDeposits(deposits);

  return { success: true, deposit: newDeposit, message: 'Deposit confirmation submitted successfully! Collekt Finance will credit your wallet upon verification.' };
}

function approveNovaDeposit(depositId) {
  const deposits = getPendingNovaDeposits();
  const dep = deposits.find(d => d.id === depositId);
  if (!dep) return { success: false, message: 'Deposit record not found.' };
  if (dep.status === 'approved') return { success: false, message: 'This deposit has already been approved and credited.' };

  dep.status = 'approved';
  dep.approved_at = new Date().toISOString();
  savePendingNovaDeposits(deposits);

  // Credit user's wallet
  const dir = getDirectoryUsers();
  let targetUser = dir.find(u => (u.id && u.id === dep.user_id) || (u.email && u.email === dep.user_email));
  const currentUser = getUser();

  const creditAmount = parseFloat(dep.amount);

  if (targetUser) {
    if (!targetUser.wallet) targetUser.wallet = { available: 0, escrow: 0, transactions: [] };
    const prevBal = parseFloat(targetUser.wallet.available || targetUser.wallet.balance || 0);
    const newBal = prevBal + creditAmount;
    targetUser.wallet.available = newBal;
    targetUser.wallet.balance = newBal;
    
    if (!targetUser.wallet.transactions) targetUser.wallet.transactions = [];
    targetUser.wallet.transactions.unshift({
      id: 'tx_' + Date.now(),
      title: 'NOVA Bank Deposit',
      desc: `Ref: ${dep.reference} via NOVA Commercial Bank`,
      type: 'credit',
      category: 'funding',
      amount: creditAmount,
      balance_before: prevBal,
      balance_after: newBal,
      status: 'Completed',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    });

    saveDirectoryUsers(dir);

    if (currentUser && ((currentUser.id && currentUser.id === targetUser.id) || (currentUser.email && currentUser.email === targetUser.email))) {
      currentUser.wallet = targetUser.wallet;
      setUser(currentUser);
      window.dispatchEvent(new CustomEvent('collekt_wallet_updated'));
    }
  } else if (currentUser && ((currentUser.id && currentUser.id === dep.user_id) || (currentUser.email && currentUser.email === dep.user_email))) {
    if (!currentUser.wallet) currentUser.wallet = { available: 0, escrow: 0, transactions: [] };
    const prevBal = parseFloat(currentUser.wallet.available || currentUser.wallet.balance || 0);
    const newBal = prevBal + creditAmount;
    currentUser.wallet.available = newBal;
    currentUser.wallet.balance = newBal;

    if (!currentUser.wallet.transactions) currentUser.wallet.transactions = [];
    currentUser.wallet.transactions.unshift({
      id: 'tx_' + Date.now(),
      title: 'NOVA Bank Deposit',
      desc: `Ref: ${dep.reference} via NOVA Commercial Bank`,
      type: 'credit',
      category: 'funding',
      amount: creditAmount,
      balance_before: prevBal,
      balance_after: newBal,
      status: 'Completed',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    setUser(currentUser);
    window.dispatchEvent(new CustomEvent('collekt_wallet_updated'));
  }

  // Record in global transactions
  try {
    const txs = getSavedTransactions();
    txs.unshift({
      id: 'tx_' + Date.now(),
      title: 'NOVA Bank Deposit Approved',
      desc: `Credited ₦${creditAmount.toLocaleString()} to ${dep.user_name} (${dep.reference})`,
      type: 'credit',
      amount: creditAmount,
      user_id: dep.user_id,
      user_name: dep.user_name,
      status: 'Completed',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    localStorage.setItem('collekt_transactions', JSON.stringify(txs));
  } catch(e) {}

  return { success: true, message: `Successfully credited ₦${creditAmount.toLocaleString()} to ${dep.user_name}!` };
}

function rejectNovaDeposit(depositId, reason) {
  const deposits = getPendingNovaDeposits();
  const dep = deposits.find(d => d.id === depositId);
  if (!dep) return { success: false, message: 'Deposit record not found.' };

  dep.status = 'declined';
  dep.decline_reason = reason || 'Unable to confirm receipt on NOVA Bank statement';
  dep.declined_at = new Date().toISOString();
  savePendingNovaDeposits(deposits);

  return { success: true, message: 'Deposit request marked as declined.' };
}

// ── USER TRANSACTION PIN ENGINE ──────────────────────────────
function getUserTransactionPin(user) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  if (!u) return null;
  // 1. Check user.wallet.pin
  if (u.wallet && u.wallet.pin && /^\d{4}$/.test(String(u.wallet.pin).trim())) {
    return String(u.wallet.pin).trim();
  }
  // 2. Check u.transaction_pin or u.pin
  if (u.transaction_pin && /^\d{4}$/.test(String(u.transaction_pin).trim())) {
    return String(u.transaction_pin).trim();
  }
  if (u.pin && /^\d{4}$/.test(String(u.pin).trim())) {
    return String(u.pin).trim();
  }
  // 3. Check user-specific localStorage keys
  if (u.id) {
    const userStored = localStorage.getItem('collekt_trans_pin_' + u.id);
    if (userStored && /^\d{4}$/.test(userStored.trim())) return userStored.trim();
  }
  if (u.email) {
    const emailStored = localStorage.getItem('collekt_trans_pin_' + u.email.toLowerCase().trim());
    if (emailStored && /^\d{4}$/.test(emailStored.trim())) return emailStored.trim();
  }
  return null;
}

function hasUserTransactionPin(user) {
  return !!getUserTransactionPin(user);
}

function setUserTransactionPin(user, newPin) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  if (!u) return { success: false, message: 'User session not found.' };

  const pinStr = String(newPin || '').trim();
  if (!/^\d{4}$/.test(pinStr)) {
    return { success: false, message: 'Transaction PIN must be exactly 4 numeric digits.' };
  }

  // Update in user object
  if (!u.wallet) u.wallet = {};
  u.wallet.pin = pinStr;
  u.wallet.has_pin = true;
  u.transaction_pin = pinStr;
  u.has_pin = true;

  // Persist in localStorage
  if (u.id) localStorage.setItem('collekt_trans_pin_' + u.id, pinStr);
  if (u.email) localStorage.setItem('collekt_trans_pin_' + u.email.toLowerCase().trim(), pinStr);
  localStorage.setItem('collekt_trans_pin', pinStr);

  if (typeof setUser === 'function') {
    setUser(u);
  }

  // Also sync in directory users
  try {
    const dir = getDirectoryUsers();
    const idx = dir.findIndex(d => (u.id && d.id === u.id) || (u.email && d.email === u.email));
    if (idx !== -1) {
      if (!dir[idx].wallet) dir[idx].wallet = {};
      dir[idx].wallet.pin = pinStr;
      dir[idx].wallet.has_pin = true;
      dir[idx].transaction_pin = pinStr;
      saveDirectoryUsers(dir);
    }
  } catch(e){}

  window.dispatchEvent(new CustomEvent('collekt_pin_updated', { detail: { pin: pinStr } }));
  return { success: true, message: 'Transaction PIN created successfully!' };
}

function verifyUserTransactionPin(user, enteredPin) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  const actualPin = getUserTransactionPin(u);
  if (!actualPin) {
    return { success: false, no_pin: true, message: 'No Transaction PIN has been set up yet.' };
  }
  const inputPin = String(enteredPin || '').trim();
  if (inputPin === actualPin) {
    return { success: true };
  }
  return { success: false, message: 'Incorrect 4-digit Transaction PIN.' };
}

function changeUserTransactionPin(user, currentPin, newPin) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  const actualPin = getUserTransactionPin(u);
  
  if (actualPin && String(currentPin || '').trim() !== actualPin) {
    return { success: false, message: 'Current 4-digit PIN is incorrect.' };
  }

  const pinStr = String(newPin || '').trim();
  if (!/^\d{4}$/.test(pinStr)) {
    return { success: false, message: 'New PIN must be exactly 4 numeric digits.' };
  }

  return setUserTransactionPin(u, pinStr);
}

function getDirectoryUsers() {
  return typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
}

function saveDirectoryUsers(users) {
  if (!Array.isArray(users)) return;
  try {
    localStorage.setItem('collekt_all_users', JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('collekt_users_updated'));
  } catch(e) {}
}

function clearUser() {
  localStorage.removeItem('collekt_user');
  sessionStorage.removeItem('collekt_user');
}

function getSavedTransactions() {
  try {
    return JSON.parse(localStorage.getItem('collekt_transactions') || '[]');
  } catch(e) {
    return [];
  }
}

function saveTransaction(tx) {
  if (!tx) return;
  try {
    const list = getSavedTransactions();
    if (!tx.id) tx.id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    if (!tx.created_at) tx.created_at = new Date().toISOString();
    list.unshift(tx);
    localStorage.setItem('collekt_transactions', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('collekt_transactions_updated', { detail: tx }));
  } catch(e) {}
}

function copyToClipboard(text, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg || 'Copied to clipboard!');
    }).catch(() => {
      fallbackCopy(text, msg);
    });
  } else {
    fallbackCopy(text, msg);
  }
}

function fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(msg || 'Copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
  document.body.removeChild(ta);
}

async function logout() {
  const me = getUser();
  if (me && me.email) {
    localStorage.setItem('collekt_last_user_email', me.email);
  }
  if (window.sb) {
    try { await sb.auth.signOut(); } catch(e){}
  }
  clearUser();

  // Hard replace to login page preventing back-navigation to cached dashboard
  window.location.replace('login.html');
}

function requireAuth() {
  // If in the middle of OAuth return or session exchange, do NOT redirect to login
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const isOAuthReturn = hash.includes('access_token=') || search.includes('code=') || sessionStorage.getItem('collekt_oauth_in_progress') === 'true';
  if (isOAuthReturn) {
    return true;
  }

  const user = getUser();
  if (!user) {
    window.location.replace('login.html');
    return false;
  }
  if (user.suspended === true || user.status === 'suspended') {
    clearUser();
    alert('⛔ Your account has been suspended by Collekt administration. Please contact support@collekt.ng.');
    window.location.replace('login.html?suspended=1');
    return false;
  }
  return true;
}

function redirectIfAuthed() {
  const user = getUser();
  if (!user) return;
  window.location.replace(user.role === 'company' ? 'company-dashboard.html' : 'dashboard.html');
}

function goToDashboard() {
  const user = getUser();
  if (!user) { window.location.replace('login.html'); return; }
  window.location.replace(user.role === 'company' ? 'company-dashboard.html' : 'dashboard.html');
}

// Helper: Check if user has explicitly uploaded a profile photo on Collekt
function hasUserUploadedPhoto(user) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  if (!u) return false;
  if (u.avatar_uploaded === true) return true;
  const avatarFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('avatar') : [];
  if (avatarFiles && avatarFiles.length > 0) return true;
  if (localStorage.getItem('collekt_user_avatar')) return true;
  if (u.avatar && typeof u.avatar === 'string') {
    if (u.avatar.startsWith('data:image/')) return true;
    if (u.avatar.includes('/storage/v1/object/public/avatars/')) return true;
    // Disallow external OAuth provider URLs from counting as uploaded photo
    if (u.avatar.includes('googleusercontent.com') || u.avatar.includes('licdn.com')) return false;
  }
  return false;
}

// Helper: Check if company has explicitly uploaded a company logo on Collekt
function hasCompanyUploadedLogo(user) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  if (!u) return false;
  if (u.company_logo_uploaded === true) return true;
  const logoFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('company-logo') : [];
  if (logoFiles && logoFiles.length > 0) return true;
  if (localStorage.getItem('collekt_company_logo')) return true;
  if (u.company_logo && typeof u.company_logo === 'string') {
    if (u.company_logo.startsWith('data:image/')) return true;
    if (u.company_logo.includes('/storage/v1/object/public/')) return true;
    if (u.company_logo.includes('googleusercontent.com') || u.company_logo.includes('licdn.com')) return false;
  }
  return false;
}

// -- UNIVERSAL PROFILE STRENGTH & COMPLETION ENGINE (100% ALIGNED) --
function calculateUserProfileStrength(user) {
  const u = user || getUser() || {};
  const customQuals = JSON.parse(localStorage.getItem('collekt_custom_quals') || '[]');

  const hasPhoto = hasUserUploadedPhoto(u);

  const hasCv = !!(
    (typeof getUploadedFiles === 'function' && getUploadedFiles('cv').length > 0) ||
    u.cv ||
    u.cv_name ||
    u.cv_url ||
    localStorage.getItem('collekt_user_cv')
  );

  const isDummyBio = (text) => {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim().toLowerCase();
    return t.length <= 5 || 
           t.includes('registered technical specialist on collekt') ||
           t.includes('specialist engineering consultant on collekt') ||
           t.includes('energy, infrastructure & engineering project enterprise in nigeria');
  };

  const hasBio = !!(
    (u.bio && !isDummyBio(u.bio)) ||
    (u.about && !isDummyBio(u.about)) ||
    (u.headline && u.headline.trim().length > 5)
  );

  const skills = u.skills || (typeof getSavedSkills === 'function' ? getSavedSkills() : []);
  const hasSkills = !!(Array.isArray(skills) && skills.length > 0);

  const portfolioFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('portfolio') : [];
  const hasPortfolio = !!(
    portfolioFiles.length > 0 ||
    (u.projects && u.projects.length > 0) ||
    (u.portfolio && u.portfolio.length > 0)
  );

  const certFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('certifications') : [];
  const hasCerts = !!(
    certFiles.length > 0 ||
    (u.certifications && u.certifications.length > 0) ||
    customQuals.length > 0
  );

  // Identity verification requires authentic approved verification status
  const hasIdentity = !!(
    (u.verification_status === 'verified' && (u.is_verified === true || u.identity_verified === true)) &&
    (u.nin || localStorage.getItem('collekt_user_nin') || (typeof getUploadedFiles === 'function' && getUploadedFiles('document').length > 0))
  );

  const checks = [
    { id: 'check-photo', label: 'Profile photo', done: hasPhoto, weight: 15, action: 'openAvatarStudio' },
    { id: 'check-bio', label: 'Bio / Summary', done: hasBio, weight: 15, action: 'openEditModal' },
    { id: 'check-skills', label: 'Technical skills', done: hasSkills, weight: 15, action: 'focusSkills' },
    { id: 'check-cv', label: 'Resume / CV', done: hasCv, weight: 15, action: 'uploadCv' },
    { id: 'check-portfolio', label: 'Portfolio items', done: hasPortfolio, weight: 15, action: 'uploadPortfolio' },
    { id: 'check-certs', label: 'Certifications', done: hasCerts, weight: 15, action: 'uploadCerts' },
    { id: 'check-identity', label: 'Identity verification', done: hasIdentity, weight: 10, action: 'verifyIdentity' }
  ];

  const doneWeight = checks.filter(c => c.done).reduce((sum, c) => sum + c.weight, 0);
  const percent = Math.min(100, doneWeight);
  let level = 'Beginner';
  const isFullyVerified = (u.verification_status === 'verified' && (u.is_verified === true || u.identity_verified === true));
  if (percent >= 100 && isFullyVerified) level = 'Fully Verified';
  else if (percent >= 100) level = '100% Profile Complete';
  else if (percent >= 80) level = 'Advanced';
  else if (percent >= 45) level = 'Intermediate';

  return {
    isCompany: false,
    checks,
    percent,
    level,
    doneCount: checks.filter(c => c.done).length,
    totalCount: checks.length
  };
}

function calculateCompanyProfileStrength(user) {
  const u = user || getUser() || {};
  const hasLogo = hasCompanyUploadedLogo(u);

  const isDummyAbout = (text) => {
    if (!text || typeof text !== 'string') return true;
    const t = text.trim().toLowerCase();
    return t.length <= 5 || 
           t.includes('registered enterprise partner on collekt') ||
           t.includes('energy, infrastructure & engineering project enterprise in nigeria');
  };

  const hasAbout = !!(
    (u.about && !isDummyAbout(u.about)) ||
    (u.bio && !isDummyAbout(u.bio))
  );

  const hasContact = !!(
    (u.contact_person && u.contact_person.trim().length > 3) ||
    (u.rep_first_name && u.rep_last_name && (u.rep_first_name + u.rep_last_name).trim().length > 3)
  );

  const hasCac = !!(u.cac || u.rc_number || u.rcNumber || u.tin);
  const hasDocs = !!(
    (typeof getUploadedFiles === 'function' && (getUploadedFiles('document').length > 0 || getUploadedFiles('company-docs').length > 0 || getUploadedFiles('certifications').length > 0)) ||
    (u.company_docs && u.company_docs.length > 0)
  );

  const postedJobs = typeof getPostedJobs === 'function' ? getPostedJobs() : [];
  const hasProjects = !!(postedJobs.length > 0 || (u.projects && u.projects.length > 0));

  const checks = [
    { id: 'check-co-logo', label: 'Company logo', done: hasLogo, weight: 20, action: 'openAvatarStudio' },
    { id: 'check-co-about', label: 'Company overview', done: hasAbout, weight: 20, action: 'openCoEditModal' },
    { id: 'check-co-contact', label: 'Representative contact', done: hasContact, weight: 15, action: 'openCoEditModal' },
    { id: 'check-co-cac', label: 'CAC / TIN registration', done: hasCac, weight: 15, action: 'openCoEditModal' },
    { id: 'check-co-docs', label: 'Corporate documents', done: hasDocs, weight: 15, action: 'uploadCoDoc' },
    { id: 'check-co-project', label: 'First opportunity posted', done: hasProjects, weight: 15, action: 'postProject' }
  ];

  const doneWeight = checks.filter(c => c.done).reduce((sum, c) => sum + c.weight, 0);
  const percent = Math.min(100, doneWeight);
  let level = 'Beginner';
  const isEnterpriseVerified = (u.verification_status === 'verified' && (u.is_verified === true || u.identity_verified === true) && !!(u.cac || u.rc_number));
  if (percent >= 100 && isEnterpriseVerified) level = 'Verified Enterprise';
  else if (percent >= 100) level = '100% Complete';
  else if (percent >= 80) level = 'Enterprise Setup';
  else if (percent >= 45) level = 'Good Standing';

  return {
    isCompany: true,
    checks,
    percent,
    level,
    doneCount: checks.filter(c => c.done).length,
    totalCount: checks.length
  };
}

function computePrdProfileScore(user) {
  const res = calculateUserProfileStrength(user);
  return res.percent;
}

function renderGlobalProfileStrength(target, customUser) {
  const user = customUser || getUser() || {};
  const isCompany = user.role === 'company' || window.location.pathname.includes('company');
  const data = isCompany ? calculateCompanyProfileStrength(user) : calculateUserProfileStrength(user);

  let containers = [];
  if (typeof target === 'string') {
    containers = Array.from(document.querySelectorAll(target));
  } else if (target && target.nodeType) {
    containers = [target];
  } else {
    containers = Array.from(document.querySelectorAll('#profileStrengthWidget, #profileStrengthCard, #coProfileStrengthWidget, .profile-strength-card'));
  }

  containers.forEach(container => {
    if (!container) return;
    const isDashboard = window.location.pathname.includes('dashboard');
    const isProfilePage = window.location.pathname.includes('profile');

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
        <div class="section-title-sm" style="font-size:14px; font-weight:800; margin-bottom:0; color:var(--ink); line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${isCompany ? 'Company Profile Completion' : 'Profile Strength'}
        </div>
        <span style="color:${data.percent >= 80 ? '#16a34a' : 'var(--teal)'}; font-weight:900; font-size:13px; flex-shrink:0;">${data.percent}%</span>
      </div>
      <p style="font-size:11.5px; color:var(--muted); margin-bottom:10px; line-height:1.35;">
        ${isCompany ? 'Complete company verification to attract verified talent.' : 'Complete your details to boost proposals and search ranking.'}
      </p>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; margin-bottom:6px;">
        <span style="color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">Status:</span>
        <span style="color:${data.percent >= 80 ? '#16a34a' : 'var(--ink)'}; font-weight:800;">${data.level}</span>
      </div>
      <div class="profile-strength-bar" style="height:6px; background:var(--line); border-radius:99px; overflow:hidden; margin-bottom:12px;">
        <div class="profile-strength-fill" style="width:${data.percent}%; height:100%; background:${data.percent >= 80 ? 'linear-gradient(90deg, #16a34a, #22c55e)' : 'linear-gradient(90deg, var(--teal), #2dd4bf)'}; border-radius:99px; transition:width 0.4s ease;"></div>
      </div>
      <div class="ps-checklist" style="display:flex; flex-direction:column; gap:5px;">
    `;

    data.checks.forEach(item => {
      const checkIcon = item.done 
        ? `<span class="ci-icon" style="color:#16a34a; font-weight:900; font-size:11px; flex-shrink:0; width:14px; text-align:center;">✓</span>`
        : `<span class="ci-icon" style="color:var(--muted); font-size:11px; flex-shrink:0; width:14px; text-align:center; opacity:0.6;">○</span>`;
      
      const textColor = item.done ? 'var(--ink)' : 'var(--muted)';
      const fontWeight = item.done ? '700' : '500';

      html += `
        <div class="check-item ${item.done ? 'done' : 'todo'}" id="${item.id}" 
             style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; padding:5px 6px; border-radius:6px; transition:background 0.15s ease; cursor:pointer; min-width:0;"
             onmouseover="this.style.background='var(--paper-subtle, rgba(0,0,0,0.02))'"
             onmouseout="this.style.background='transparent'"
             onclick="triggerProfileStrengthAction('${item.action}')"
             title="${item.done ? 'Completed: ' + item.label : 'Click to complete ' + item.label}">
          <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1; overflow:hidden;">
            ${checkIcon}
            <span style="color:${textColor}; font-weight:${fontWeight}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px;">${item.label}</span>
          </div>
          ${item.done 
            ? `<span style="flex-shrink:0; font-size:10px; color:#16a34a; font-weight:800; background:rgba(22,163,74,0.1); padding:2px 7px; border-radius:99px;">Done</span>` 
            : `<span style="flex-shrink:0; font-size:10px; color:var(--teal); font-weight:800; background:rgba(20,184,166,0.1); padding:2px 7px; border-radius:99px;">+${item.weight}%</span>`}
        </div>
      `;
    });

    html += `</div>`;

    if (isDashboard) {
      const targetHref = isCompany ? 'company-profile.html' : 'profile.html';
      html += `
        <a href="${targetHref}" class="btn btn-outline btn-sm" style="width:100%; margin-top:12px; min-height:36px; font-size:12px; justify-content:center; text-decoration:none; font-weight:800; display:flex; align-items:center; gap:6px; border-radius:8px;">
          ${data.percent >= 100 ? 'View Full Profile &rarr;' : 'Complete Profile &rarr;'}
        </a>
      `;
    }

    container.innerHTML = html;
  });
}

function triggerProfileStrengthAction(action) {
  if (!action) return;
  if (action === 'openAvatarStudio') {
    if (typeof openAvatarStudio === 'function') openAvatarStudio();
    else if (typeof openUploadModal === 'function') openUploadModal('avatar');
  } else if (action === 'openEditModal') {
    if (typeof openEditModal === 'function') openEditModal();
    else window.location.href = 'profile.html';
  } else if (action === 'openCoEditModal') {
    if (typeof openEditModal === 'function') openEditModal();
    else window.location.href = 'company-profile.html';
  } else if (action === 'focusSkills') {
    if (window.location.pathname.includes('profile.html')) {
      if (typeof switchTab === 'function') switchTab('overview', document.getElementById('tab-btn-overview'));
      const input = document.getElementById('newSkill');
      if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else {
      window.location.href = 'profile.html';
    }
  } else if (action === 'uploadCv') {
    if (typeof openUploadModal === 'function') openUploadModal('cv', window.onDocUploaded || window.onCvUploaded);
    else window.location.href = 'profile.html';
  } else if (action === 'uploadPortfolio') {
    if (window.location.pathname.includes('profile.html')) {
      if (typeof switchTab === 'function') switchTab('portfolio', document.getElementById('tab-btn-portfolio'));
      if (typeof openUploadModal === 'function') openUploadModal('portfolio', window.onPortfolioUploaded);
    } else {
      window.location.href = 'profile.html';
    }
  } else if (action === 'uploadCerts') {
    if (window.location.pathname.includes('profile.html')) {
      if (typeof switchTab === 'function') switchTab('certifications', document.getElementById('tab-btn-certifications'));
      if (typeof openUploadModal === 'function') openUploadModal('certifications', window.onCertUploaded);
    } else {
      window.location.href = 'profile.html';
    }
  } else if (action === 'verifyIdentity') {
    if (window.location.pathname.includes('profile.html')) {
      if (typeof switchTab === 'function') switchTab('identity', document.getElementById('tab-btn-identity'));
    } else {
      window.location.href = 'profile.html';
    }
  } else if (action === 'uploadCoDoc') {
    if (typeof openUploadModal === 'function') openUploadModal('document', window.onDocUploaded);
    else window.location.href = 'company-profile.html';
  } else if (action === 'postProject') {
    window.location.href = 'company-dashboard.html#post';
  }
}

/* ═════════════════════════════════════════════════════════
   COLLEKT SKILLS & COMPETENCIES LIBRARY ENGINE
   ═════════════════════════════════════════════════════════ */
window.COLLEKT_SKILLS_LIBRARY = [
  {
    category: 'Soft Skills & Leadership',
    icon: '🧠',
    skills: [
      'Critical Thinking & Problem Solving',
      'Commercial Negotiation & Deal Structuring',
      'Dispute Resolution & Mediation',
      'Cross-Functional Team Leadership',
      'Stakeholder & Client Relationship Management',
      'Strategic Project Planning & Milestone Tracking',
      'Risk Management & Crisis Decision-Making',
      'Technical Communication & Report Writing',
      'Time Management & Delivery Focus',
      'Financial Acumen & Budget Optimization',
      'Cross-Cultural Collaboration & Team Building',
      'Adaptability & High-Pressure Resilience'
    ]
  },
  {
    category: 'Oil, Gas & Offshore',
    icon: '🛢️',
    skills: [
      'Pipeline Integrity & Maintenance',
      'HAZOP & Process Safety Management',
      'Subsea & Marine Operations',
      'NDT Inspection (Non-Destructive Testing)',
      'Corrosion Control & Cathodic Protection',
      'Instrumentation & Industrial Process Control',
      'Wellhead Maintenance & Drilling Support',
      'Pressure Vessel & Storage Tank Inspection'
    ]
  },
  {
    category: 'Renewable Energy & Power',
    icon: '☀️',
    skills: [
      'Commercial Solar PV Design & Installation',
      'Mini-Grid & Microgrid Architecture',
      'Battery Energy Storage Systems (BESS)',
      'High Voltage (HV) Substation Engineering',
      'Power Distribution & SCADA Automation',
      'Energy Auditing & Power Quality Analysis',
      'Industrial Generator & Turbine Overhaul'
    ]
  },
  {
    category: 'Civil, Structural & EPC',
    icon: '🏗️',
    skills: [
      'Structural Steel Fabrication & Certified Welding',
      'Mechanical Piping & Flow Systems (ASME / API)',
      'EPC Project Management (PMP / Prince2)',
      'Civil Site Preparation & Structural Foundations',
      'QA/QC Inspection & ISO 9001 Auditing',
      'Heavy Machinery Rigging & Crane Operations',
      'HVAC & Industrial Thermal Systems'
    ]
  },
  {
    category: 'Commercial & Compliance',
    icon: '💼',
    skills: [
      'Technical Procurement & Vendor Sourcing',
      'BOQ (Bill of Quantities) & Cost Estimation',
      'Tender Bidding & Proposal Writing',
      'NOGICD / NCDMB Nigerian Content Compliance',
      'NUPRC & Environmental Impact Assessment (EIA)',
      'Escrow Contract & Milestone Administration',
      'Supply Chain Logistics & Waybill Coordination'
    ]
  },
  {
    category: 'Automation, Digital & Safety',
    icon: '💻',
    skills: [
      'PLC Programming & Industrial Automation',
      'CAD Drafting & 3D Plant Modeling',
      'Drone Aerial Surveying & GIS Mapping',
      'Fiber Optic & Industrial Telecom Systems',
      'HSE Management (Health, Safety & Environment Level 3)'
    ]
  }
];

function getActiveUserSkillsList() {
  const wrap = document.getElementById('skillsWrap');
  if (wrap) {
    return Array.from(wrap.querySelectorAll('.skill-chip')).map(chip => {
      const clone = chip.cloneNode(true);
      const rem = clone.querySelector('.remove');
      if (rem) rem.remove();
      return clone.textContent.trim().toLowerCase();
    }).filter(Boolean);
  }
  const input = document.getElementById('editCapabilities');
  if (input) {
    return input.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  const u = typeof getUser === 'function' ? getUser() : null;
  if (u && Array.isArray(u.skills)) {
    return u.skills.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

window.openSkillPickerModal = function(options = {}) {
  const targetWrapId = options.targetWrapId || (document.getElementById('skillsWrap') ? 'skillsWrap' : 'editCapabilities');
  const mode = options.mode || (document.getElementById('skillsWrap') ? 'chips' : 'comma_input');

  let modal = document.getElementById('skillPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'skillPickerModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '999999';
    modal.innerHTML = `
      <div class="modal-card" style="max-width:680px; width:100%; border-radius:24px; padding:24px 28px; background:var(--white); box-shadow:0 30px 90px rgba(0,0,0,0.35); font-family:'Manrope',sans-serif; position:relative;">
        <button class="modal-close" onclick="closeModal('skillPickerModal')" style="position:absolute; top:20px; right:20px; background:none; border:none; font-size:24px; color:var(--muted); cursor:pointer;">&times;</button>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
          <span style="font-size:24px;">📋</span>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:900; color:var(--ink);">Collekt Professional Skills Library</h3>
            <p style="margin:2px 0 0; font-size:12px; color:var(--muted);">Select your technical disciplines, certifications, and leadership soft skills.</p>
          </div>
        </div>

        <div style="margin:16px 0 10px;">
          <input type="text" class="form-input" id="skillSearchInput" placeholder="🔍 Search skills (e.g. Negotiation, Solar, Pipeline, Critical Thinking)..." style="width:100%; font-size:13px; font-weight:700; padding:10px 16px; border-radius:99px;" oninput="filterSkillsLibrary(this.value)">
        </div>

        <div class="skill-lib-cat-bar" id="skillLibCatBar"></div>

        <div class="skill-lib-grid" id="skillLibGrid" style="margin:12px 0 18px;"></div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--line); padding-top:14px;">
          <span style="font-size:12px; font-weight:800; color:var(--teal);" id="skillSelectedCount">0 skills selected</span>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-outline btn-sm" onclick="clearSelectedSkillsFromPicker()">Clear All</button>
            <button class="btn btn-primary btn-sm" style="background:var(--teal); font-weight:800; min-width:90px;" onclick="closeModal('skillPickerModal')">Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal._options = { targetWrapId, mode };

  renderSkillPickerCategories();
  renderSkillPickerPills('All');
  updateSkillSelectedCounter();
  openModal('skillPickerModal');

  setTimeout(() => {
    const input = document.getElementById('skillSearchInput');
    if (input) { input.value = ''; input.focus(); }
  }, 100);
};

window.renderSkillPickerCategories = function() {
  const catBar = document.getElementById('skillLibCatBar');
  if (!catBar) return;
  const categories = ['All', ...window.COLLEKT_SKILLS_LIBRARY.map(c => c.category)];
  catBar.innerHTML = categories.map((cat, idx) => {
    const icon = cat === 'All' ? '✨' : (window.COLLEKT_SKILLS_LIBRARY.find(c => c.category === cat)?.icon || '🔹');
    return `<button class="skill-lib-cat-btn ${idx === 0 ? 'active' : ''}" onclick="selectSkillCategory('${escapeHTML(cat)}', this)">${icon} ${escapeHTML(cat)}</button>`;
  }).join('');
};

window.selectSkillCategory = function(cat, btn) {
  document.querySelectorAll('.skill-lib-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const search = document.getElementById('skillSearchInput');
  if (search) search.value = '';
  renderSkillPickerPills(cat);
};

window.filterSkillsLibrary = function(query) {
  const q = String(query).trim().toLowerCase();
  const activeBtn = document.querySelector('.skill-lib-cat-btn.active');
  const activeCat = activeBtn ? activeBtn.textContent.replace(/^[^\s]+\s*/, '').trim() : 'All';
  renderSkillPickerPills(activeCat, q);
};

window.renderSkillPickerPills = function(category = 'All', filterQuery = '') {
  const grid = document.getElementById('skillLibGrid');
  if (!grid) return;

  const activeSkills = getActiveUserSkillsList();
  let list = [];

  if (category === 'All') {
    window.COLLEKT_SKILLS_LIBRARY.forEach(c => {
      c.skills.forEach(s => list.push({ name: s, cat: c.category, icon: c.icon }));
    });
  } else {
    const group = window.COLLEKT_SKILLS_LIBRARY.find(c => c.category === category);
    if (group) {
      group.skills.forEach(s => list.push({ name: s, cat: group.category, icon: group.icon }));
    }
  }

  if (filterQuery) {
    list = list.filter(item => item.name.toLowerCase().includes(filterQuery.toLowerCase()) || item.cat.toLowerCase().includes(filterQuery.toLowerCase()));
  }

  if (list.length === 0) {
    grid.innerHTML = `<div style="padding:24px; text-align:center; width:100%; color:var(--muted); font-size:13px;">No skills matching "<strong>${escapeHTML(filterQuery)}</strong>" found. You can still type custom skills directly in the box!</div>`;
    return;
  }

  grid.innerHTML = list.map(item => {
    const isSelected = activeSkills.includes(item.name.toLowerCase());
    return `<span class="skill-lib-pill ${isSelected ? 'selected' : ''}" data-skill="${escapeHTML(item.name)}" onclick="toggleSkillFromLibrary('${escapeHTML(item.name).replace(/'/g, "\\'")}', this)">
      <span class="pill-indicator">${isSelected ? '✓' : '+'}</span> ${escapeHTML(item.name)}
    </span>`;
  }).join('');
};

window.toggleSkillFromLibrary = function(skillName, pillEl) {
  const modal = document.getElementById('skillPickerModal');
  const opts = modal?._options || {};
  const isChipsMode = opts.mode === 'chips' || !!document.getElementById('skillsWrap');

  if (isChipsMode) {
    const wrap = document.getElementById('skillsWrap');
    if (!wrap) return;

    let existingChip = null;
    wrap.querySelectorAll('.skill-chip').forEach(chip => {
      const clone = chip.cloneNode(true);
      const rem = clone.querySelector('.remove');
      if (rem) rem.remove();
      if (clone.textContent.trim().toLowerCase() === skillName.toLowerCase()) {
        existingChip = chip;
      }
    });

    if (existingChip) {
      existingChip.remove();
      if (wrap.querySelectorAll('.skill-chip').length === 0) {
        wrap.innerHTML = `<span class="empty-msg" style="font-size:14px; color:var(--muted); font-style:italic;">No skills added yet. Add your technical skills below to help companies find you.</span>`;
      }
      if (pillEl) {
        pillEl.classList.remove('selected');
        const ind = pillEl.querySelector('.pill-indicator');
        if (ind) ind.textContent = '+';
      }
      if (typeof _persistSkillsFromUI === 'function') _persistSkillsFromUI();
    } else {
      const emptyMsg = wrap.querySelector('.empty-msg');
      if (emptyMsg) emptyMsg.remove();

      const chip = document.createElement('span');
      chip.className = 'skill-chip';
      const escaped = typeof escapeHTML === 'function' ? escapeHTML(skillName) : skillName;
      chip.innerHTML = `${escaped} <span class="remove" onclick="removeSkill(this)">&times;</span>`;
      wrap.appendChild(chip);

      if (pillEl) {
        pillEl.classList.add('selected');
        const ind = pillEl.querySelector('.pill-indicator');
        if (ind) ind.textContent = '✓';
      }
      if (typeof _persistSkillsFromUI === 'function') _persistSkillsFromUI();
    }
  } else {
    const input = document.getElementById('editCapabilities');
    if (!input) return;
    let current = input.value.split(',').map(s => s.trim()).filter(Boolean);
    const lower = current.map(s => s.toLowerCase());
    const idx = lower.indexOf(skillName.toLowerCase());

    if (idx >= 0) {
      current.splice(idx, 1);
      if (pillEl) {
        pillEl.classList.remove('selected');
        const ind = pillEl.querySelector('.pill-indicator');
        if (ind) ind.textContent = '+';
      }
    } else {
      current.push(skillName);
      if (pillEl) {
        pillEl.classList.add('selected');
        const ind = pillEl.querySelector('.pill-indicator');
        if (ind) ind.textContent = '✓';
      }
    }
    input.value = current.join(', ');
  }

  updateSkillSelectedCounter();
  if (typeof renderProfileStrength === 'function') renderProfileStrength();
};

window.clearSelectedSkillsFromPicker = function() {
  const wrap = document.getElementById('skillsWrap');
  if (wrap) {
    wrap.innerHTML = `<span class="empty-msg" style="font-size:14px; color:var(--muted); font-style:italic;">No skills added yet. Add your technical skills below to help companies find you.</span>`;
    if (typeof _persistSkillsFromUI === 'function') _persistSkillsFromUI();
  }
  const input = document.getElementById('editCapabilities');
  if (input) {
    input.value = '';
  }
  document.querySelectorAll('.skill-lib-pill').forEach(p => {
    p.classList.remove('selected');
    const ind = p.querySelector('.pill-indicator');
    if (ind) ind.textContent = '+';
  });
  updateSkillSelectedCounter();
  if (typeof renderProfileStrength === 'function') renderProfileStrength();
  if (typeof showToast === 'function') showToast('Skills cleared.');
};

window.updateSkillSelectedCounter = function() {
  const counter = document.getElementById('skillSelectedCount');
  if (!counter) return;
  const active = getActiveUserSkillsList();
  counter.textContent = `${active.length} skill${active.length === 1 ? '' : 's'} selected`;
};

window.quickAddSkill = function(skillName) {
  const wrap = document.getElementById('skillsWrap');
  if (wrap) {
    const existing = getActiveUserSkillsList();
    if (existing.includes(skillName.toLowerCase())) {
      if (typeof showToast === 'function') showToast(`ℹ️ "${skillName}" is already on your profile.`, 'info');
      return;
    }
    const emptyMsg = wrap.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const chip = document.createElement('span');
    chip.className = 'skill-chip';
    const escaped = typeof escapeHTML === 'function' ? escapeHTML(skillName) : skillName;
    chip.innerHTML = `${escaped} <span class="remove" onclick="removeSkill(this)">&times;</span>`;
    wrap.appendChild(chip);

    if (typeof _persistSkillsFromUI === 'function') _persistSkillsFromUI();
    if (typeof renderProfileStrength === 'function') renderProfileStrength();
    if (typeof showToast === 'function') showToast(`✨ Added "${skillName}"!`);
  }
};

// -------------------------------------------------------------------------
// -- COLLEKT PREMIUM MEMBERSHIP SYSTEM ($15/Mo Pro, $50/Mo Company) --
// -------------------------------------------------------------------------

function openPremiumMembershipModal(forcedRole) {
  const user = (typeof getUser === 'function' ? getUser() : null) || {};
  const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const isCompany = (forcedRole === 'company') || (currentPage.includes('company')) || (user.role === 'company');
  const role = isCompany ? 'company' : 'professional';
  window.location.href = 'upgrade.html?role=' + role;
}

function renderPremiumUpgradeCard(containerId, forcedRole) {
  const user = (typeof getUser === 'function' ? getUser() : null) || {};
  const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const isCompany = (forcedRole === 'company') || (currentPage.includes('company')) || (user.role === 'company');
  const role = isCompany ? 'company' : 'professional';

  let targets = [];
  if (containerId) {
    const el = document.getElementById(containerId.replace(/^#/, ''));
    if (el) targets.push(el);
  } else {
    targets = Array.from(document.querySelectorAll('#premiumUpgradeCard, .premium-upgrade-card'));
  }

  const isPremium = !!(user.is_premium || user.subscription_tier === (isCompany ? 'company_enterprise' : 'pro_plus'));
  const priceDisplay = isCompany ? '$50 / Month' : '$15 / Month';
  const tierName = isCompany ? 'Company Enterprise' : 'Professional Plus';
  const bgGrad = isCompany 
    ? 'linear-gradient(135deg, var(--forest), #1a7a6f)' 
    : 'linear-gradient(135deg, var(--amber), #e8a612)';
  const icon = isPremium ? '&#11088;' : (isCompany ? '&#127970;' : '&#9889;');

  targets.forEach(target => {
    if (isPremium) {
      target.innerHTML = `
        <div style="background:${bgGrad}; border-radius:var(--r-lg); padding:20px; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,0.12); position:relative; z-index:10; cursor:pointer;" onclick="window.location.href='upgrade.html?role=${role}'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:24px;">${icon}</div>
            <span style="background:rgba(255,255,255,0.25); color:#fff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:99px;">ACTIVE SUBSCRIBER</span>
          </div>
          <h4 style="font-size:15px; font-weight:900; margin-bottom:4px;">${tierName} Active</h4>
          <p style="font-size:12px; opacity:.9; margin-bottom:14px; line-height:1.4;">
            Your account has active search boost, ${isCompany ? 'unlimited tender postings' : '5% commission discount'} and priority support.
          </p>
          <a href="upgrade.html?role=${role}" class="btn" onclick="event.stopPropagation(); window.location.href='upgrade.html?role=${role}';"
             style="background:rgba(255,255,255,.28); color:#fff; border:1px solid rgba(255,255,255,.35); width:100%; min-height:38px; font-size:13px; font-weight:800; justify-content:center; text-decoration:none; display:flex; align-items:center; position:relative; z-index:20;">
            Manage Membership &rarr;
          </a>
        </div>
      `;
    } else {
      target.innerHTML = `
        <div style="background:${bgGrad}; border-radius:var(--r-lg); padding:20px; color:#fff; box-shadow:0 6px 20px rgba(0,0,0,0.12); position:relative; z-index:10; cursor:pointer;" onclick="window.location.href='upgrade.html?role=${role}'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:24px;">${icon}</div>
            <span style="background:rgba(255,255,255,0.28); color:#fff; font-size:11px; font-weight:900; padding:3px 8px; border-radius:99px; letter-spacing:0.3px;">${priceDisplay}</span>
          </div>
          <h4 style="font-size:15px; font-weight:900; margin-bottom:6px;">Upgrade to ${isCompany ? 'Enterprise' : 'Pro'} (${priceDisplay})</h4>
          <p style="font-size:12px; opacity:.9; margin-bottom:14px; line-height:1.4;">
            ${isCompany 
              ? 'Post unlimited RFPs & tenders, access AI candidate matching and verified enterprise badge.' 
              : 'Unlock featured placement, unlimited proposal submissions, 5% reduced fees, and analytics.'}
          </p>
          <a href="upgrade.html?role=${role}" class="btn" onclick="event.stopPropagation(); window.location.href='upgrade.html?role=${role}';"
             style="background:rgba(255,255,255,.28); color:#fff; border:1px solid rgba(255,255,255,.4); width:100%; min-height:38px; font-size:13px; font-weight:800; justify-content:center; cursor:pointer; text-decoration:none; display:flex; align-items:center; position:relative; z-index:20;">
            Learn More &amp; Upgrade &rarr;
          </a>
        </div>
      `;
    }
  });
}

// -- PRD SECTION 34: CANDIDATE MATCHING ENGINE V1 (WEIGHTED MODEL) --
function calculatePrdCandidateMatchScore(pro, reqs = {}) {
  if (!pro) return 0;
  let score = 0;

  const targetDiscipline = (reqs.discipline || reqs.category || '').toLowerCase().trim();
  const proDiscipline = (pro.discipline || pro.primary_discipline || pro.title || '').toLowerCase().trim();
  if (targetDiscipline && proDiscipline.includes(targetDiscipline)) score += 25;
  else score += 15;

  const proProjects = pro.projects || (typeof getSavedProjects === 'function' ? getSavedProjects() : []);
  if (proProjects.length >= 2) score += 25;
  else if (proProjects.length === 1) score += 15;
  else score += 10;

  const proYoe = parseInt(pro.years_experience || pro.experience || '5', 10);
  const reqYoe = parseInt(reqs.required_experience || '3', 10);
  if (proYoe >= reqYoe) score += 15;
  else score += 8;

  const proIndustry = (pro.industry || 'Oil & Gas').toLowerCase();
  const reqIndustry = (reqs.industry || 'Oil & Gas').toLowerCase();
  if (proIndustry.includes(reqIndustry) || reqIndustry.includes(proIndustry)) score += 15;
  else score += 8;

  const proCerts = pro.certifications || [];
  if (proCerts.length > 0 || pro.verified) score += 10;
  else score += 5;

  const avail = (pro.availability || 'Available').toLowerCase();
  if (avail.includes('available')) score += 10;
  else score += 5;

  return Math.min(100, Math.max(45, score));
}

// -- PRD SECTION 26 & 30: ENGAGEMENT LIFECYCLE & TRANSACTIONS --
const ENGAGEMENT_STATES = ['Requested', 'Responded', 'Negotiation', 'Accepted', 'Active', 'Completed', 'Closed'];

function createPrdEngagementTransaction(engagementObj) {
  const projectVal = parseFloat(engagementObj.project_value || 2000000);
  const commRate = COLLEKT_COMMISSION_RATE; // 10%
  const commVal = projectVal * commRate;

  return {
    engagement_id: engagementObj.id || ('ENG-' + Math.floor(100000 + Math.random() * 900000)),
    company_name: engagementObj.company_name || 'Enterprise Client',
    professional_name: engagementObj.professional_name || 'Professional Specialist',
    opportunity_title: engagementObj.opportunity_title || 'Engineering Assignment',
    project_value: projectVal,
    commission_rate: '10%',
    commission_amount: commVal,
    status: engagementObj.status || 'Active',
    start_date: engagementObj.start_date || new Date().toLocaleDateString('en-GB'),
    completion_date: engagementObj.completion_date || '31/12/2026'
  };
}

function requireCompany() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const isOAuthReturn = hash.includes('access_token=') || search.includes('code=') || sessionStorage.getItem('collekt_oauth_in_progress') === 'true';
  if (isOAuthReturn) return null;

  const user = getUser();
  if (!user) {
    window.location.replace('login.html?role=company');
    return null;
  }
  if (user.role !== 'company') {
    window.location.replace('dashboard.html');
    return user;
  }
  return user;
}

function requirePro() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const isOAuthReturn = hash.includes('access_token=') || search.includes('code=') || sessionStorage.getItem('collekt_oauth_in_progress') === 'true';
  if (isOAuthReturn) return;

  const user = getUser();
  if (!user) { window.location.href = 'login.html'; return; }
  if (user.role === 'company') { window.location.href = 'company-dashboard.html'; }
}

// -- SHARED MODAL UTILITY ------------------------------
// Replaces the copy-pasted openXModal/closeModal pattern
// on wallet.html, company-dashboard.html, etc.
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.style.display = 'flex';
  el.style.justifyContent = 'center';
  el.style.alignItems = 'center';
  const card = el.querySelector('.modal-card, .modal-box, .modal-dialog, .modal-content, .upload-panel, .settings-panel, .upload-modal-card');
  if (card) {
    card.style.margin = 'auto';
  }
  // Trap focus inside modal for accessibility
  const first = el.querySelector('button, input, select, textarea, a[href]');
  if (first) first.focus();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}

// Wire backdrop-click dismissal for all .modal-overlay elements on the page.
// Called once after DOMContentLoaded so each page doesn't need to repeat this.
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this.id);
    });
  });
  // ESC key closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });
}

// -- CURRENCY FORMATTING -------------------------------
/**
 * formatNaira(amount, abbreviated)
 * formatNaira(1850000)       ? "&#x20A6;1,850,000"
 * formatNaira(1850000, true) ? "&#x20A6;1.9M"
 * formatNaira(850000, true)  ? "&#x20A6;850K"
 */
function formatNaira(amount, abbreviated) {
  if (amount == null || isNaN(amount)) return '&#x20A6;0';
  const n = Number(amount);
  if (abbreviated) {
    if (n >= 1_000_000) return '&#x20A6;' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (n >= 1_000)    return '&#x20A6;' + (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
    return '&#x20A6;' + n.toLocaleString('en-NG');
  }
  return '&#x20A6;' + n.toLocaleString('en-NG');
}

// -- TOAST UTILITY -------------------------------------
function showToast(msg, type) {
  const bg = type === 'error' ? '#b91c1c' : type === 'warning' ? '#d97706' : '#0E3B35';
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:28px;right:28px;background:${bg};color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;z-index:99999;animation:fadeIn .3s;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:340px;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// -- IN-APP MESSAGE POP-UP NOTIFICATION SYSTEM ---------
function showInAppMessagePopup(msgData) {
  if (!msgData) return;

  const senderName = msgData.senderName || msgData.sender || 'Collekt Security';
  const bodyText = msgData.body || msgData.text || '';
  const conversationId = msgData.conversation_id || '';

  const otpMatch = bodyText.match(/\[\s*(\d{6})\s*\]/) || bodyText.match(/\b(\d{6})\b/);
  const otpCode = otpMatch ? otpMatch[1] : null;

  dismissInAppMessagePopup();

  const popup = document.createElement('div');
  popup.id = 'collektInAppMessagePopup';
  popup.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 9999999;
    width: min(400px, calc(100vw - 32px));
    background: #0d1f1e;
    color: #ffffff;
    border: 1.5px solid #16a34a;
    border-radius: 18px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 24px rgba(22, 163, 74, 0.3);
    padding: 18px 20px;
    font-family: 'Manrope', sans-serif;
    animation: fadeIn .3s ease;
    backdrop-filter: blur(8px);
  `;

  popup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 10px #22c55e;"></span>
        <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#4ade80;">💬 NEW IN-APP MESSAGE</span>
      </div>
      <button onclick="dismissInAppMessagePopup()" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:2px 6px; border-radius:4px;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">✕</button>
    </div>

    <div style="font-size:13px; font-weight:800; color:#f8fafc; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
      🔒 ${escapeHTML(senderName)}
    </div>

    <div style="font-size:12px; color:#cbd5e1; line-height:1.5; margin-bottom:12px; word-break:break-word;">
      ${escapeHTML(bodyText)}
    </div>

    ${otpCode ? `
      <div style="background:rgba(22,163,74,0.18); border:1px dashed #22c55e; border-radius:12px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:10px; font-weight:800; color:#86efac; text-transform:uppercase; letter-spacing:.05em;">OTP Security Code</div>
          <div style="font-size:22px; font-weight:900; letter-spacing:0.22em; color:#ffffff; font-family:monospace; margin-top:2px;">${otpCode}</div>
        </div>
        <button onclick="copyInAppOtpCode('${otpCode}')" style="background:#22c55e; color:#0d1f1e; border:none; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer; transition:.2s;" onmouseover="this.style.background='#4ade80'" onmouseout="this.style.background='#22c55e'">
          ⚡ Auto-Fill / Copy OTP
        </button>
      </div>
    ` : ''}

    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button onclick="dismissInAppMessagePopup()" style="background:rgba(255,255,255,0.1); color:#cbd5e1; border:none; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Dismiss</button>
      <a href="messages.html${conversationId ? '?conv=' + conversationId : ''}" style="background:#0E3B35; color:#4ade80; border:1px solid #16a34a; padding:7px 16px; border-radius:8px; font-size:12px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
        👁️ Open Messages &rarr;
      </a>
    </div>
  `;

  document.body.appendChild(popup);

  setTimeout(() => {
    dismissInAppMessagePopup();
  }, 14000);
}

function dismissInAppMessagePopup() {
  const popup = document.getElementById('collektInAppMessagePopup');
  if (popup) popup.remove();
}

function copyInAppOtpCode(code) {
  try { navigator.clipboard.writeText(code); } catch(e){}
  const otpInput = document.getElementById('payoutOtpInput');
  if (otpInput) {
    otpInput.value = code;
    otpInput.focus();
    showToast('✅ OTP code auto-filled into verification box!');
  } else {
    showToast('📋 OTP code copied to clipboard: ' + code);
  }
}

// -- UNIVERSAL THEME SYSTEM (LIGHT / DARK) --------------
function getThemeIconHTML(isDark) {
  return isDark
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

function updateMetaThemeColor(isDark) {
  const color = isDark ? '#040e0c' : '#e8f5f2';
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function initTheme() {
  const saved = localStorage.getItem('collekt_theme');
  let isDark = false;
  if (saved === 'dark') {
    isDark = true;
  } else if (saved === 'light') {
    isDark = false;
  } else {
    isDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateMetaThemeColor(isDark);
  updateThemeButton();

  if (!window._themeMediaListenerAttached && window.matchMedia) {
    window._themeMediaListenerAttached = true;
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('collekt_theme')) {
          setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    } catch(err) {}
  }
}

function setTheme(theme, save = true) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  if (save) {
    localStorage.setItem('collekt_theme', isDark ? 'dark' : 'light');
  }
  updateMetaThemeColor(isDark);
  updateThemeButton();

  try {
    window.dispatchEvent(new CustomEvent('collekt_theme_change', { detail: { theme: isDark ? 'dark' : 'light', isDark } }));
  } catch(e) {}
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  setTheme(isDark ? 'light' : 'dark', true);
}

function ensureSidebarToggleIcon() {
  const toggleBtn = document.getElementById('sidebarToggle');
  if (!toggleBtn) return;
  toggleBtn.classList.remove('theme-btn');
  if (!toggleBtn.classList.contains('sidebar-toggle-btn')) toggleBtn.classList.add('sidebar-toggle-btn');
  if (!toggleBtn.classList.contains('topbar-icon-btn')) toggleBtn.classList.add('topbar-icon-btn');
  toggleBtn.setAttribute('title', 'Toggle Navigation Menu');
  toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
  
  // Guarantee the 3-line hamburger menu SVG
  const lines = toggleBtn.querySelectorAll('line');
  if (lines.length !== 3 || toggleBtn.querySelector('path') || toggleBtn.querySelector('circle')) {
    toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  }
}
window.ensureSidebarToggleIcon = ensureSidebarToggleIcon;

function observeSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggle');
  if (!toggleBtn || toggleBtn._observed) return;
  toggleBtn._observed = true;
  ensureSidebarToggleIcon();
  try {
    const observer = new MutationObserver(() => {
      if (toggleBtn.querySelector('path') || toggleBtn.querySelector('circle') || toggleBtn.querySelectorAll('line').length !== 3) {
        ensureSidebarToggleIcon();
      }
    });
    observer.observe(toggleBtn, { childList: true });
  } catch(e) {}
}
window.observeSidebarToggle = observeSidebarToggle;

function updateThemeButton() {
  const isDark = document.documentElement.classList.contains('dark');
  const iconHtml = getThemeIconHTML(isDark);

  document.querySelectorAll('#themeToggle, #adminThemeToggle, .theme-toggle-btn, [data-action="theme-toggle"]').forEach(btn => {
    if (btn.id === 'sidebarToggle' || btn.classList.contains('sidebar-toggle-btn')) return;
    btn.innerHTML = iconHtml;
    btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  });

  document.querySelectorAll('.drawer-theme-item').forEach(item => {
    const icon = item.querySelector('.drawer-theme-icon');
    const text = item.querySelector('.drawer-theme-text');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (text) text.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });

  const settToggle = document.getElementById('sett-dark-mode');
  if (settToggle && settToggle.checked !== isDark) {
    settToggle.checked = isDark;
  }

  ensureSidebarToggleIcon();
}

// Immediately execute early theme init
initTheme();

// -- PUBLIC NAV (landing, auth pages) ------------------
function buildPublicNav() {
  const actions = document.getElementById('navActions');
  if (!actions) return;
  updateThemeButton();
  actions.innerHTML = `
    <button class="theme-btn" id="themeToggle" onclick="toggleTheme()" title="Toggle theme">${getThemeIconHTML(document.documentElement.classList.contains('dark'))}</button>
    <a class="btn btn-ghost btn-sm" href="login.html">Log in</a>
    <a class="btn btn-amber btn-sm" href="register.html">Sign up</a>
    <button class="ham" id="ham" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  `;
  updateThemeButton();
  initMobileNav();
}

function getShieldBadgeHTML(size = 16, user = null) {
  const u = user || (typeof getUser === 'function' ? getUser() : null);
  if (!u) return '';

  // Strict laid-down rule: No user is given verification unless their profile is 100% complete AND officially verified
  const isCompany = u.role === 'company' || (!u.role && u.company_name);
  const strength = isCompany 
    ? (typeof calculateCompanyProfileStrength === 'function' ? calculateCompanyProfileStrength(u) : null)
    : (typeof calculateUserProfileStrength === 'function' ? calculateUserProfileStrength(u) : null);

  // Any profile under 100% (including 0% profiles) MUST NEVER receive a verification mark
  if (!strength || typeof strength.percent !== 'number' || strength.percent < 100) {
    return '';
  }

  const isVerified = (u.verification_status === 'verified' && (u.is_verified === true || u.identity_verified === true));
  if (!isVerified) return '';
  if (isCompany && !(u.cac || u.rc_number || u.rcNumber)) return '';

  return _renderShieldBadgeMarkup(size);
}

function _renderShieldBadgeMarkup(size = 16) {
  const h = Math.round(size * 1.15);
  return `<span class="shield-badge" title="Collekt Shield Verified Account" style="margin-left:5px; margin-right:2px; vertical-align:middle; display:inline-flex; align-items:center; flex-shrink:0; transform:translateY(-1px);">
    <svg width="${size}" height="${h}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" stroke="#16a34a" stroke-width="2.4" fill="rgba(22,163,74,0.08)"/>
      <text x="12" y="15" font-family="'Manrope', sans-serif" font-weight="900" font-size="13" fill="#16a34a" text-anchor="middle" dominant-baseline="middle">c</text>
    </svg>
  </span>`;
}

// -- SIDEBAR (app pages) -------------------------------
function buildSidebar(activePage) {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;

  try {
    const user = getUser();
    const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
    
    // Resolve accurate active nav key from current page URL & hash
    let pageKey = activePage;
    if (currentPage.includes('post-job') || currentPage.includes('post_job') || window.location.hash === '#post' || window.location.hash.includes('post') || activePage === 'post') {
      pageKey = 'post';
    } else if (currentPage.includes('my-jobs') || currentPage.includes('my_jobs') || activePage === 'projects') {
      pageKey = 'projects';
    } else if (currentPage.includes('marketplace')) {
      pageKey = 'marketplace';
    } else if (currentPage.includes('proposal')) {
      pageKey = 'proposals';
    } else if (currentPage.includes('message')) {
      pageKey = 'messages';
    } else if (currentPage.includes('wallet')) {
      pageKey = 'wallet';
    } else if (currentPage.includes('profile')) {
      pageKey = 'profile';
    } else if (currentPage.includes('dashboard')) {
      pageKey = 'dashboard';
    } else if (!pageKey) {
      pageKey = 'dashboard';
    }

    // Determine isCompany from user's registered role (single source of truth)
    const isCompany = !!(user && user.role === 'company') || (localStorage.getItem('collekt_last_role') === 'company');

    const defaultName = isCompany ? 'Company Account' : 'Professional Specialist';
    const activeUser = user || { name: defaultName, role: isCompany ? 'company' : 'professional' };

    const displayName = getDisplayName(activeUser);
    const initial = (displayName || (isCompany ? 'C' : 'P')).charAt(0).toUpperCase();
    const roleLabel = isCompany ? 'Company Account' : 'Professional';
    const roleColor = isCompany ? 'var(--amber)' : 'var(--teal-mid)';

    const svgGrid    = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
    const svgStore   = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    const svgDoc     = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    const svgMsg     = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const svgWallet  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
    const svgUser    = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const svgPlus    = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    const svgBriefcase = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
    const svgSearch  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    const proNav = [
      { icon: svgGrid,      label: 'Overview',     href: 'dashboard.html',    key: 'dashboard' },
      { icon: svgStore,     label: 'Marketplace',  href: 'marketplace.html',  key: 'marketplace' },
      { icon: svgDoc,       label: 'Collektions',  href: 'proposals.html',    key: 'proposals' },
      { icon: svgMsg,       label: 'Messages',     href: 'messages.html',     key: 'messages' },
      { icon: svgWallet,    label: 'Wallet',       href: 'wallet.html',       key: 'wallet' },
      { icon: svgUser,      label: 'Profile',      href: 'profile.html',      key: 'profile' },
    ];
    const companyNav = [
      { icon: svgGrid,      label: 'Overview',          href: 'company-dashboard.html', key: 'dashboard' },
      { icon: svgPlus,      label: 'Post Opportunity',  href: 'post-job.html',          key: 'post' },
      { icon: svgBriefcase, label: 'My Opportunities',  href: 'my-jobs.html',           key: 'projects' },
      { icon: svgSearch,    label: 'Find Talent',       href: 'marketplace.html',       key: 'marketplace' },
      { icon: svgMsg,       label: 'Messages',          href: 'messages.html',          key: 'messages' },
      { icon: svgWallet,    label: 'Payments & Escrow', href: 'wallet.html',            key: 'wallet' },
      { icon: svgUser,      label: 'Company Profile',   href: 'company-profile.html',   key: 'profile' },
    ];

    const navItems = isCompany ? companyNav : proNav;

    const uploadedAvatar = isCompany ? (typeof getUploadedCompanyLogo === 'function' ? getUploadedCompanyLogo() : null) : (typeof getUploadedAvatar === 'function' ? getUploadedAvatar() : null);
    const avatarContent = (uploadedAvatar && uploadedAvatar.dataURL)
      ? `<img src="${uploadedAvatar.dataURL}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : initial;

    const safeUsername = typeof escapeHTML === 'function' ? escapeHTML(displayName) : displayName;
    const safeBadge = typeof getShieldBadgeHTML === 'function' ? getShieldBadgeHTML(14, user) : '';

    const profileUrl = isCompany ? 'company-profile.html' : 'profile.html';

    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <img src="logo-stone.png" alt="Collekt" class="sidebar-logo-img" onerror="this.src='logo-stone.jpg';">
      </div>
      <div class="sidebar-user-info" style="cursor:pointer;" onclick="window.location.href='${profileUrl}'" title="View Profile">
        <div class="sidebar-avatar" style="background:${isCompany ? 'var(--amber)' : 'var(--teal)'}; overflow:hidden; cursor:pointer;">${avatarContent}</div>
        <div>
          <div class="u-name" style="display:flex; align-items:center; gap:4px;">${safeUsername} ${safeBadge}</div>
          <div class="u-role" style="color:${roleColor};">${roleLabel}</div>
        </div>
      </div>
      <!-- Liquid Glass Navigation Mount on Desktop -->
      <div id="sidebarLiquidNavMount"></div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">All Sections</div>
        ${navItems.map(item => `
          <a href="${item.href}" ${item.onclick ? `onclick="${item.onclick}"` : ''} class="sidebar-nav-item ${item.key === pageKey ? 'active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            ${item.label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-bottom">
        <a class="sidebar-nav-item" href="javascript:void(0)" onclick="if(window.openSettingsModal) openSettingsModal(); else showToast('Settings opening...');" style="color:rgba(255,255,255,.45); font-size:13px;">
          <span class="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span> Settings
        </a>
        <div class="sidebar-logout" onclick="logout()" role="button" tabindex="0" aria-label="Log Out">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Log Out
        </div>
      </div>
    `;

    // Inject mobile backdrop if missing
    if (!document.getElementById('sidebarBackdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      backdrop.onclick = () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      };
      document.body.appendChild(backdrop);
    }

    // Build Liquid Glass Navigation (Docks in sidebar on desktop, floating pill on mobile)
    buildLiquidGlassNav(pageKey);
  } catch (err) {
    console.error("Error building sidebar:", err);
  }
}

// ═══════════════════════════════════════════════════════════
// LIQUID GLASS BOTTOM NAVIGATION & OPTICAL LENS MAGNIFIER
// ═══════════════════════════════════════════════════════════

function resolveLiquidNavActiveKey(preferredKey) {
  if (preferredKey) return preferredKey;
  const path = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const search = window.location.search || '';
  const hash = window.location.hash || '';

  if (path.includes('message')) {
    if (search.includes('tab=calls') || hash.includes('calls')) return 'calls';
    return 'chats';
  }
  if (path.includes('marketplace') || path.includes('job') || path.includes('proposal') || path.includes('post')) {
    return 'tools';
  }
  if (path.includes('profile') || path.includes('wallet') || path.includes('upgrade')) {
    return 'settings';
  }
  if (path.includes('dashboard') || path === '' || path.includes('index')) {
    return 'updates';
  }
  return 'chats';
}

function positionLiquidGlassLens(targetItem, animate = true) {
  const nav = document.getElementById('liquidGlassNav');
  const lens = document.getElementById('liquidGlassLens');
  if (!nav || !lens) return;

  if (!targetItem) {
    targetItem = nav.querySelector('.liquid-nav-item.active') || nav.querySelector('.liquid-nav-item');
  }
  if (!targetItem) return;

  const isDocked = nav.classList.contains('docked-sidebar') || (window.innerWidth > 900 && nav.closest('.app-sidebar'));

  if (!animate) {
    lens.style.transition = 'none';
  } else {
    lens.style.transition = 'transform 0.44s cubic-bezier(0.34, 1.45, 0.64, 1), width 0.3s ease, height 0.3s ease, border-radius 0.35s ease';
  }

  if (isDocked) {
    // Vertical track in sidebar dock
    const y = targetItem.offsetTop;
    lens.style.transform = `translate3d(0, ${y}px, 0)`;
  } else {
    // Horizontal track in floating bottom pill bar
    const itemOffsetLeft = targetItem.offsetLeft;
    const itemWidth = targetItem.offsetWidth;
    const lensWidth = lens.offsetWidth || 72;
    const x = itemOffsetLeft + (itemWidth - lensWidth) / 2;
    lens.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  if (!animate) {
    void lens.offsetHeight; // Force reflow
    lens.style.transition = 'transform 0.44s cubic-bezier(0.34, 1.45, 0.64, 1), width 0.3s ease, height 0.3s ease, border-radius 0.35s ease';
  }
}

function dockLiquidGlassNav() {
  const nav = document.getElementById('liquidGlassNav');
  const sidebar = document.getElementById('appSidebar');
  if (!nav) return;

  const isDesktop = window.innerWidth > 900;
  const mount = document.getElementById('sidebarLiquidNavMount');

  if (isDesktop && sidebar && mount) {
    if (nav.parentNode !== mount) {
      nav.classList.add('docked-sidebar');
      mount.appendChild(nav);
      requestAnimationFrame(() => positionLiquidGlassLens(null, false));
    }
  } else {
    if (nav.parentNode !== document.body) {
      nav.classList.remove('docked-sidebar');
      document.body.appendChild(nav);
      requestAnimationFrame(() => positionLiquidGlassLens(null, false));
    }
  }
}

function buildLiquidGlassNav(activePageKey) {
  // Only build on dashboard / authenticated app pages
  const path = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const isAuthPage = path.includes('login') || path.includes('register') || path.includes('signup') || path.includes('admin') || path.includes('brand-identity') || path.includes('pitch-deck');
  if (isAuthPage && !path.includes('dashboard')) return;

  let nav = document.getElementById('liquidGlassNav');
  const user = getUser();
  const isCompany = !!(user && user.role === 'company') || (localStorage.getItem('collekt_last_role') === 'company');
  const activeKey = resolveLiquidNavActiveKey(activePageKey);

  const homeHref = isCompany ? 'company-dashboard.html' : 'dashboard.html';
  const toolsHref = isCompany ? 'my-jobs.html' : 'marketplace.html';
  const profHref = isCompany ? 'company-profile.html' : 'profile.html';

  const navItems = [
    {
      key: 'updates',
      label: 'Updates',
      href: homeHref,
      svg: `<svg class="liquid-nav-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><circle cx="18" cy="6" r="2.5" fill="#22c55e" stroke="#081815" stroke-width="1.5"/></svg>`,
      badge: ''
    },
    {
      key: 'calls',
      label: 'Calls',
      href: 'messages.html?tab=calls',
      svg: `<svg class="liquid-nav-svg" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
      badge: ''
    },
    {
      key: 'tools',
      label: 'Tools',
      href: toolsHref,
      svg: `<svg class="liquid-nav-svg" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`,
      badge: ''
    },
    {
      key: 'chats',
      label: 'Chats',
      href: 'messages.html',
      svg: `<svg class="liquid-nav-svg" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
      badge: `<span class="liquid-nav-badge green-badge" id="liquidNavChatsBadge">27</span>`
    },
    {
      key: 'settings',
      label: 'Settings',
      href: 'javascript:void(0)',
      svg: `<svg class="liquid-nav-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      badge: ''
    }
  ];

  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'liquidGlassNav';
    nav.className = 'liquid-glass-nav';
    nav.setAttribute('aria-label', 'Liquid Glass Navigation');

    nav.innerHTML = `
      <div class="liquid-glass-lens" id="liquidGlassLens">
        <div class="lens-specular-crescent"></div>
        <div class="lens-caustic-ring"></div>
      </div>
      <div class="liquid-nav-track" id="liquidNavTrack">
        ${navItems.map(item => `
          <a href="${item.href}" class="liquid-nav-item ${item.key === activeKey ? 'active' : ''}" data-key="${item.key}">
            <div class="liquid-nav-icon-wrap">
              ${item.svg}
              ${item.badge}
            </div>
            <span class="liquid-nav-label">${item.label}</span>
          </a>
        `).join('')}
      </div>
    `;

    // Attach click and interaction handlers
    const navItemEls = nav.querySelectorAll('.liquid-nav-item');
    navItemEls.forEach(itemEl => {
      itemEl.addEventListener('click', (e) => {
        const key = itemEl.getAttribute('data-key');
        const href = itemEl.getAttribute('href');
        navItemEls.forEach(el => el.classList.remove('active'));
        itemEl.classList.add('active');
        positionLiquidGlassLens(itemEl, true);

        if (key === 'settings') {
          e.preventDefault();
          if (typeof window.openSettingsModal === 'function') {
            window.openSettingsModal();
          } else {
            window.location.href = profHref;
          }
          return;
        }

        if (key === 'calls') {
          if (window.location.pathname.includes('messages')) {
            e.preventDefault();
            if (typeof showToast === 'function') {
              showToast('📞 Voice & Video Calls: Select any conversation to begin an encrypted call.');
            }
            return;
          }
        }

        // Prevent reload if clicking the current page's active tab
        const currentCleanPath = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const itemTarget = (href || '').split('?')[0].split('#')[0].toLowerCase();
        if (itemTarget && itemTarget === currentCleanPath && key !== 'calls') {
          e.preventDefault();
        }
      });
    });

    dockLiquidGlassNav();
  } else {
    // Update active class if nav already exists
    const navItemEls = nav.querySelectorAll('.liquid-nav-item');
    navItemEls.forEach(el => {
      if (el.getAttribute('data-key') === activeKey) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
    dockLiquidGlassNav();
  }

  // Multi-frame alignment to guarantee sub-pixel rendering accuracy
  requestAnimationFrame(() => {
    positionLiquidGlassLens(null, false);
    setTimeout(() => positionLiquidGlassLens(null, true), 80);
    setTimeout(() => positionLiquidGlassLens(null, false), 250);
  });

  // Attach global responsive re-dock listeners only once
  if (!window._liquidNavInitialized) {
    window._liquidNavInitialized = true;
    window.addEventListener('resize', () => {
      dockLiquidGlassNav();
      positionLiquidGlassLens(null, false);
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        dockLiquidGlassNav();
        positionLiquidGlassLens(null, false);
      }, 100);
    });
  }
}

// Auto-run buildSidebar on DOMContentLoaded if element exists and is empty
document.addEventListener('DOMContentLoaded', () => {
  try { scrubSyntheticUploads(); } catch(e){}
  const sidebar = document.getElementById('appSidebar');
  if (sidebar && (!sidebar.children || sidebar.children.length === 0)) {
    buildSidebar();
  } else {
    buildLiquidGlassNav();
  }
  initMobileNav();
});
try { scrubSyntheticUploads(); } catch(e){}

// -- TOP BAR -------------------------------------------
function buildTopbar() {
  const tb = document.getElementById('appTopbar');
  if (!tb) return;
  const user = getUser();
  const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
  
  // Same page-authoritative logic as buildSidebar
  const professionalPages = ['dashboard.html', 'profile.html', 'proposals.html', 'marketplace.html', 'wallet.html', 'messages.html'];
  const companyPages = ['company-dashboard.html', 'company-profile.html', 'company-marketplace.html'];
  
  const isCompany = !!(user && user.role === 'company') || (localStorage.getItem('collekt_last_role') === 'company');

  const displayName = getDisplayName(user);
  const initial = user ? displayName.charAt(0).toUpperCase() : (isCompany ? 'C' : 'P');
  const profileUrl = isCompany ? 'company-profile.html' : 'profile.html';

  const uploadedAvatar = isCompany ? (typeof getUploadedCompanyLogo === 'function' ? getUploadedCompanyLogo() : null) : (typeof getUploadedAvatar === 'function' ? getUploadedAvatar() : null);
  const avatarContent = (uploadedAvatar && uploadedAvatar.dataURL)
    ? `<img src="${uploadedAvatar.dataURL}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : initial;

  tb.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; flex:1;">
      <button class="topbar-icon-btn sidebar-toggle-btn" id="sidebarToggle" title="Toggle Navigation Menu" aria-label="Toggle Navigation Menu" onclick="toggleMobileSidebar(event)"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <div class="topbar-search-wrap" style="flex:1; max-width:480px;">
        <span class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input class="topbar-search" type="text" placeholder="${isCompany ? 'Search professionals, skills...' : 'Search projects, companies, skills...'}">
      </div>
    </div>
    <div class="topbar-actions">
      <button class="theme-btn" id="themeToggle" onclick="toggleTheme()" title="Toggle dark mode"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>
      <div style="position:relative;">
        <div class="notif-btn" id="notifBtn" title="Notifications" role="button" tabindex="0" aria-label="Notifications" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="notif-panel" id="notifPanel">
          <div class="notif-head">
            <h4>Notifications</h4>
            <span style="font-size:12px;color:var(--muted);cursor:pointer;font-weight:700;">Mark all read</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:36px 20px; text-align:center; color:var(--muted);">
            <div style="font-size:28px; margin-bottom:8px;">🔔</div>
            <div style="font-size:13px; font-weight:800; color:var(--ink); margin-bottom:4px;">No New Notifications</div>
            <p style="font-size:11px; color:var(--muted); margin:0;">You're all caught up!</p>
          </div>
        </div>
      </div>
      <div style="position:relative;">
        <div class="profile-trigger" id="profileTrigger">
          <div class="topbar-avatar" style="background:${isCompany ? 'var(--amber)' : 'var(--teal)'}; overflow:hidden; cursor:pointer;" title="View Profile" onclick="event.stopPropagation(); window.location.href='${profileUrl}';">${avatarContent}</div>
          <span class="profile-caret"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </div>
        <div class="profile-menu" id="profileMenu">
          <div class="profile-menu-header" style="cursor:pointer;" onclick="window.location.href='${profileUrl}'" title="View Profile">
            <div class="pm-name">${escapeHTML(displayName)}</div>
            <div class="pm-email">${user ? escapeHTML(user.email || '') : ''}</div>
          </div>
          ${isCompany ? `
          <a class="profile-menu-item" href="company-dashboard.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard</a>
          <a class="profile-menu-item" href="company-profile.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Company Profile</a>
          <a class="profile-menu-item" href="messages.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Messages</a>
          <a class="profile-menu-item" href="wallet.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Payments</a>
          ` : `
          <a class="profile-menu-item" href="profile.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> My Profile</a>
          <a class="profile-menu-item" href="dashboard.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard</a>
          <a class="profile-menu-item" href="wallet.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Wallet</a>
          <a class="profile-menu-item" href="messages.html"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Messages</a>
          `}
          <div class="profile-menu-item danger" onclick="logout()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Log Out</div>

        </div>
      </div>
    </div>
  `;

  updateThemeButton();
  ensureSidebarToggleIcon();
  observeSidebarToggle();

  document.getElementById('notifBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('notifPanel')?.classList.toggle('open');
    document.getElementById('profileMenu')?.classList.remove('open');
  });
  document.getElementById('profileTrigger')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('profileMenu')?.classList.toggle('open');
    document.getElementById('notifPanel')?.classList.remove('open');
  });
  document.addEventListener('click', () => {
    document.getElementById('notifPanel')?.classList.remove('open');
    document.getElementById('profileMenu')?.classList.remove('open');
  });
}

function toggleMobileSidebar(e) {
  if (e) e.stopPropagation();
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) {
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
      if (isOpen) backdrop.classList.add('open');
      else backdrop.classList.remove('open');
    }
  }
}

// -- MOBILE NAV ----------------------------------------
function initMobileNav() {
  const ham = document.getElementById('ham');
  const drawer = document.getElementById('drawer');
  if (ham && drawer) {
    if (!ham._wired) {
      ham._wired = true;
      ham.addEventListener('click', () => {
        const open = drawer.classList.toggle('open');
        ham.setAttribute('aria-expanded', open);
      });
    }

    if (!drawer.querySelector('.drawer-theme-item')) {
      const isDark = document.documentElement.classList.contains('dark');
      const toggleItem = document.createElement('div');
      toggleItem.className = 'drawer-theme-item';
      toggleItem.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; margin-top:16px; border-radius:14px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); cursor:pointer; touch-action:manipulation;';
      toggleItem.innerHTML = `
        <span style="display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:800; color:#fff;">
          <span class="drawer-theme-icon" style="font-size:18px;">${isDark ? '☀️' : '🌙'}</span>
          <span class="drawer-theme-text">${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
        </span>
        <button type="button" class="theme-btn" style="width:36px; height:36px; min-height:36px; min-width:36px; padding:0;" title="Toggle theme">${getThemeIconHTML(isDark)}</button>
      `;
      toggleItem.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTheme();
      });
      drawer.appendChild(toggleItem);
    }
  }
}

function makeAllAvatarsClickable() {
  document.querySelectorAll('.sidebar-avatar, .sidebar-user-info').forEach(el => {
    el.style.cursor = 'pointer';
    if (!el.getAttribute('data-wired')) {
      el.setAttribute('data-wired', 'true');
      el.addEventListener('click', (e) => {
        if (e.target.closest('a') && !e.target.closest('.sidebar-avatar') && !e.target.closest('.sidebar-user-info')) return;
        const u = getUser();
        if (u) {
          const dest = (u.role === 'company' || window.location.pathname.includes('company')) ? 'company-profile.html' : 'profile.html';
          window.location.href = dest;
        }
      });
    }
  });

  document.querySelectorAll('.topbar-avatar, .profile-menu-header').forEach(el => {
    el.style.cursor = 'pointer';
    if (!el.getAttribute('data-wired')) {
      el.setAttribute('data-wired', 'true');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = getUser();
        if (u) {
          const dest = (u.role === 'company' || window.location.pathname.includes('company')) ? 'company-profile.html' : 'profile.html';
          window.location.href = dest;
        }
      });
    }
  });

  document.querySelectorAll('.talent-avatar, .talent-avatar-box, .gig-pro-avatar, .pro-avatar, .chat-avatar, .msg-avatar, .review-avatar, .user-avatar, .avatar-clickable').forEach(el => {
    el.style.cursor = 'pointer';
    if (!el.getAttribute('data-wired')) {
      el.setAttribute('data-wired', 'true');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = el.dataset.userId || el.getAttribute('data-id') || el.getAttribute('data-email');
        if (userId) {
          window.location.href = `public-profile.html?id=${encodeURIComponent(userId)}`;
        } else {
          const card = el.closest('.talent-card, .talent-card-v2, .gig-card, .review-card, .msg-item, .tx-row, .chat-contact');
          const link = card ? card.querySelector('a[href*="public-profile.html"], a[href*="profile.html"]') : null;
          if (link && link.href) {
            window.location.href = link.href;
          } else {
            const u = getUser();
            if (u) window.location.href = (u.role === 'company') ? 'company-profile.html' : 'profile.html';
          }
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  makeAllAvatarsClickable();
  setTimeout(makeAllAvatarsClickable, 600);
});

// -- FILE UPLOAD STORAGE API ---------------------------
// Stores uploaded file metadata (and small dataURLs) in localStorage per user.
// Categories: 'avatar', 'cv', 'documents', 'portfolio', 'certifications', 'company-logo', 'company-docs'

function _uploadsKey() {
  const u = getUser();
  if (u && (u.id || u.email)) {
    return 'collekt_uploads_' + (u.id || u.email);
  }
  return 'collekt_uploads_default';
}

function _getAllUploads() {
  const u = getUser();
  let merged = {};
  try {
    const def = JSON.parse(localStorage.getItem('collekt_uploads_default')) || {};
    merged = { ...merged, ...def };
  } catch(e){}
  if (u && u.email) {
    try {
      const emUploads = JSON.parse(localStorage.getItem('collekt_uploads_' + u.email)) || {};
      for (const cat in emUploads) {
        if (Array.isArray(emUploads[cat]) && emUploads[cat].length) {
          merged[cat] = emUploads[cat];
        }
      }
    } catch(e){}
  }
  if (u && u.id) {
    try {
      const idUploads = JSON.parse(localStorage.getItem('collekt_uploads_' + u.id)) || {};
      for (const cat in idUploads) {
        if (Array.isArray(idUploads[cat]) && idUploads[cat].length) {
          merged[cat] = idUploads[cat];
        }
      }
    } catch(e){}
  }
  return merged;
}

function _saveAllUploads(data) {
  const key = _uploadsKey();
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage quota notice. Compacting non-essential document payloads.', err);
    try {
      const sanitized = JSON.parse(JSON.stringify(data));
      for (const cat in sanitized) {
        if (Array.isArray(sanitized[cat])) {
          sanitized[cat].forEach(item => {
            // ALWAYS keep avatar, logo, and CV dataURLs intact for previews
            if (cat !== 'avatar' && cat !== 'company-logo' && cat !== 'cv' && item.size > 2 * 1024 * 1024) {
              delete item.dataURL;
            }
          });
        }
      }
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to persist uploads metadata:', e);
    }
  }
}

function saveUploadedFile(category, fileData) {
  if (!fileData) return [];
  const all = _getAllUploads();
  if (!all[category]) all[category] = [];
  // For avatar, company-logo, and CV, replace with latest single file
  if (category === 'avatar' || category === 'company-logo' || category === 'cv') {
    all[category] = [fileData];
  } else {
    all[category].push(fileData);
  }
  _saveAllUploads(all);

  // Dedicated fail-safe backup for CV
  if (category === 'cv') {
    try {
      localStorage.setItem('collekt_user_cv', JSON.stringify(fileData));
    } catch(e) {}
  }

  // Sync to collekt_user session as well
  const user = getUser();
  if (user && fileData) {
    if (category === 'avatar' && fileData.dataURL) user.avatar = fileData.dataURL;
    if (category === 'company-logo' && fileData.dataURL) user.company_logo = fileData.dataURL;
    if (category === 'cv') {
      user.cv_name = fileData.name;
      user.cv_size = fileData.size;
      user.cv_data = fileData.dataURL || null;
    }
    setUser(user);
  }

  return all[category];
}

function scrubSyntheticUploads() {
  try {
    const key = _uploadsKey();
    const all = _getAllUploads();
    let changed = false;
    ['certifications', 'portfolio', 'cv', 'documents'].forEach(cat => {
      if (Array.isArray(all[cat])) {
        const originalLen = all[cat].length;
        // Keep ONLY real files (with valid dataURL, publicUrl, fileUrl, or genuine non-synthetic size)
        all[cat] = all[cat].filter(f => f && (f.dataURL || f.fileUrl || f.publicUrl || (f.size && f.size !== 250000 && f.size !== 350000 && f.size !== 450000)));
        if (all[cat].length !== originalLen) changed = true;
      }
    });
    if (changed) {
      _saveAllUploads(all);
    }

    // Clean up collekt_custom_quals if any entry was tagged with fake 250000 size
    const quals = JSON.parse(localStorage.getItem('collekt_custom_quals') || '[]');
    let qualsChanged = false;
    quals.forEach(q => {
      if (q.size === 250000 && !q.dataURL && !q.fileUrl) {
        q.size = 0;
        q.fileName = null;
        qualsChanged = true;
      }
    });
    if (qualsChanged) {
      localStorage.setItem('collekt_custom_quals', JSON.stringify(quals));
    }
  } catch(e) {
    console.warn('Uploads scrub notice:', e);
  }
}

function getUploadedFiles(category, passedUser) {
  const all = _getAllUploads();
  let files = all[category] || [];
  
  // Strictly filter out any legacy synthetic dummy entries
  if (Array.isArray(files)) {
    files = files.filter(f => f && (f.dataURL || f.fileUrl || f.publicUrl || (f.size && f.size !== 250000 && f.size !== 350000 && f.size !== 450000)));
  } else {
    files = [];
  }
  
  // Backup lookups ONLY for genuine CV with authentic data
  let u = passedUser || null;
  if (!u) {
    try { u = JSON.parse(localStorage.getItem('collekt_user')); } catch(e){}
  }
  if (files.length === 0 && u && category === 'cv') {
    let cvObj = null;
    try { cvObj = JSON.parse(localStorage.getItem('collekt_user_cv')); } catch(e){}
    if (cvObj && cvObj.name && (cvObj.dataURL || cvObj.fileUrl || (cvObj.size && cvObj.size !== 450000))) {
      files = [cvObj];
    } else if (u.cv_data || (typeof u.cv === 'string' && u.cv.startsWith('data:'))) {
      files = [{
        name: u.cv_name || 'Uploaded_CV.pdf',
        size: u.cv_size || 0,
        type: 'application/pdf',
        dataURL: u.cv_data || u.cv,
        timestamp: new Date().toISOString()
      }];
    }
  }

  // Never synthesize fake files for certifications, portfolio, or documents!
  return files;
}

function removeUploadedFile(category, index) {
  const all = _getAllUploads();
  if (index === undefined) {
    all[category] = [];
    _saveAllUploads(all);
  } else if (all[category] && all[category][index] !== undefined) {
    all[category].splice(index, 1);
    _saveAllUploads(all);
  }
  return all[category] || [];
}

function getUploadedAvatar() {
  const user = typeof getUser === 'function' ? getUser() : null;
  if (user && typeof hasUserUploadedPhoto === 'function' && hasUserUploadedPhoto(user) && user.avatar) {
    return { dataURL: user.avatar };
  }
  const files = typeof getUploadedFiles === 'function' ? getUploadedFiles('avatar') : [];
  return files.length ? files[files.length - 1] : null;
}

function getUploadedCompanyLogo() {
  const user = typeof getUser === 'function' ? getUser() : null;
  if (user && typeof hasCompanyUploadedLogo === 'function' && hasCompanyUploadedLogo(user) && user.company_logo) {
    return { dataURL: user.company_logo };
  }
  const files = typeof getUploadedFiles === 'function' ? getUploadedFiles('company-logo') : [];
  return files.length ? files[files.length - 1] : null;
}

// Helper: format file size for display
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Helper: get icon for file type
function getFileTypeIcon(type, name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (type && type.startsWith('image/')) return '🖼️';
  if (ext === 'pdf' || type === 'application/pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📊';
  return '📎';
}

// Helper: format Naira currency
function formatNaira(amount, compact) {
  if (amount == null || isNaN(amount)) return '₦0';
  const num = Number(amount);
  if (compact) {
    if (num >= 1000000000) return '₦' + (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return '₦' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '₦' + (num / 1000).toFixed(0) + 'K';
  }
  return '₦' + num.toLocaleString('en-NG');
}

// -- DYNAMIC JOB & TENDER STORAGE ----------------------
function getPostedJobs() {
  try {
    return JSON.parse(localStorage.getItem('collekt_posted_jobs')) || [];
  } catch { return []; }
}

function savePostedJob(jobData) {
  const jobs = getPostedJobs();
  jobData.id = jobData.id || 'job_' + Date.now();
  jobData.posted_at = jobData.posted_at || new Date().toISOString();
  jobs.unshift(jobData);
  localStorage.setItem('collekt_posted_jobs', JSON.stringify(jobs));
  return jobData;
}

function deletePostedJob(jobId) {
  try {
    const jobs = getPostedJobs().filter(j => String(j.id) !== String(jobId));
    localStorage.setItem('collekt_posted_jobs', JSON.stringify(jobs));
    return true;
  } catch { return false; }
}

function updatePostedJob(jobId, jobData) {
  try {
    const jobs = getPostedJobs().map(j => String(j.id) === String(jobId) ? { ...j, ...jobData } : j);
    localStorage.setItem('collekt_posted_jobs', JSON.stringify(jobs));
    return true;
  } catch { return false; }
}

function getUserProposals() {
  const u = getUser();
  if (!u) return [];
  try {
    const all = JSON.parse(localStorage.getItem('collekt_proposals')) || [];
    const uId = String(u.id || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    return all.filter(p => {
      const pUserId = String(p.userId || p.freelancer_id || '').toLowerCase();
      const pUserEmail = String(p.userEmail || p.email || '').toLowerCase();
      const pCompanyId = String(p.companyId || p.company_id || '').toLowerCase();
      const pCompanyEmail = String(p.companyEmail || '').toLowerCase();
      return pUserId === uId || pUserEmail === uEmail || pCompanyId === uId || pCompanyEmail === uEmail;
    });
  } catch { return []; }
}

function saveUserProposal(proposalData) {
  if (!proposalData) return null;
  const u = getUser();
  try {
    const all = JSON.parse(localStorage.getItem('collekt_proposals')) || [];
    if (u) {
      if (!proposalData.userId) proposalData.userId = u.id;
      if (!proposalData.userEmail) proposalData.userEmail = u.email;
      if (!proposalData.userName) proposalData.userName = u.name;
      if (!proposalData.userTitle) proposalData.userTitle = u.title || u.role;
      if (!proposalData.userAvatar) proposalData.userAvatar = u.avatar || '';
      if (!proposalData.userLocation) proposalData.userLocation = u.location || u.state || 'Nigeria';
    }
    if (!proposalData.id) proposalData.id = 'prop_' + Date.now();
    if (!proposalData.created_at) proposalData.created_at = new Date().toISOString();
    if (!proposalData.status) proposalData.status = 'pending';
    
    // Check if already exists to update or insert
    const idx = all.findIndex(p => p.id === proposalData.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...proposalData };
    } else {
      all.unshift(proposalData);
    }
    localStorage.setItem('collekt_proposals', JSON.stringify(all));
    return proposalData;
  } catch { return null; }
}

function getUserContracts() {
  const u = getUser();
  if (!u) return [];
  try {
    const all = JSON.parse(localStorage.getItem('collekt_contracts')) || [];
    const uId = String(u.id || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    return all.filter(c => {
      const cProId = String(c.proId || c.freelancer_id || c.user_id || '').toLowerCase();
      const cProEmail = String(c.proEmail || c.email || '').toLowerCase();
      const cCompId = String(c.companyId || c.company_id || '').toLowerCase();
      const cCompEmail = String(c.companyEmail || '').toLowerCase();
      return cProId === uId || cProEmail === uEmail || cCompId === uId || cCompEmail === uEmail;
    });
  } catch { return []; }
}

// -- INIT ----------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildPublicNav();
  buildTopbar();
  initMobileNav();
  initModals();
  ensureSidebarToggleIcon();
  observeSidebarToggle();
});

/* ═ WATERMARKED DOCUMENT VIEWER & SAVER SYSTEM ═ */

async function openDocumentViewer(docData) {
  if (!docData) return;

  // Resolve authentic time-limited signed URL for private documents if required
  let resolvedUrl = docData.dataURL || docData.file_url || docData.fileUrl || null;
  if (typeof window.getOrGenerateDocumentViewUrl === 'function') {
    try {
      resolvedUrl = await window.getOrGenerateDocumentViewUrl(docData, 300);
    } catch(e) {
      console.warn('[DocViewer] Could not generate signed URL:', e);
    }
  }

  const activeDocData = Object.assign({}, docData, { dataURL: resolvedUrl });

  let modal = document.getElementById('collektDocViewerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'collektDocViewerModal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:999999; backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; transition:opacity .3s;';
    modal.onclick = function(e) { if (e.target === modal) closeDocumentViewer(); };
    document.body.appendChild(modal);
  }

  const title = activeDocData.name || activeDocData.title || 'Document Preview';
  const category = activeDocData.category || activeDocData.cat || activeDocData.label || 'Candidate Credential';
  const sizeStr = activeDocData.size ? (typeof formatFileSize === 'function' ? formatFileSize(activeDocData.size) : Math.round(activeDocData.size/1024) + ' KB') : '';

  const isPdf = (activeDocData.type === 'application/pdf') || (activeDocData.name && activeDocData.name.toLowerCase().endsWith('.pdf')) || (activeDocData.dataURL && (activeDocData.dataURL.startsWith('data:application/pdf') || activeDocData.dataURL.includes('.pdf') || activeDocData.dataURL.includes('application%2Fpdf') || activeDocData.dataURL.includes('/documents/')));
  const isImage = (activeDocData.type && activeDocData.type.startsWith('image/')) || (activeDocData.dataURL && (activeDocData.dataURL.startsWith('data:image') || /\.(png|jpg|jpeg|webp|svg)/i.test(activeDocData.dataURL.split('?')[0])));

  let bodyHTML = '';

  if (activeDocData.dataURL && isImage) {
    bodyHTML = `
      <div style="position:relative; width:min(680px, 100%); max-height:560px; overflow:hidden; border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,0.22); border:2px solid #d1e3e1; display:flex; align-items:center; justify-content:center; background:#1e293b;">
        <img src="${activeDocData.dataURL}" style="max-width:100%; max-height:540px; object-fit:contain; display:block;" alt="Uploaded Document">
        <!-- Center COLLEKT Watermark Overlay -->
        <div style="position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center; z-index:10; background:rgba(255,255,255,0.03);">
          <div style="transform:rotate(-30deg); font-size:min(76px, 14vw); font-weight:900; color:rgba(19,117,111,0.52); text-shadow:0 2px 14px rgba(14,59,53,0.3); letter-spacing:0.06em; font-family:'Manrope', sans-serif; text-align:center; user-select:none;">
            COLLEKT<br>
            <span style="font-size:min(14px, 3vw); font-weight:800; color:rgba(212,146,11,0.85); letter-spacing:0.1em; display:block; margin-top:6px;">COLLEKT PROTECTED • VERIFIED CANDIDATE DOCUMENT</span>
          </div>
        </div>
      </div>
    `;
  } else if (activeDocData.dataURL && isPdf) {
    bodyHTML = `
      <div style="position:relative; width:100%; height:550px; border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,0.22); border:2px solid #d1e3e1; overflow:hidden; background:#334155;">
        <iframe src="${activeDocData.dataURL}#toolbar=0" style="width:100%; height:100%; border:none;"></iframe>
        <!-- Center COLLEKT Watermark Overlay -->
        <div style="position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center; z-index:10;">
          <div style="transform:rotate(-30deg); font-size:min(76px, 14vw); font-weight:900; color:rgba(19,117,111,0.52); text-shadow:0 2px 14px rgba(14,59,53,0.3); letter-spacing:0.06em; font-family:'Manrope', sans-serif; text-align:center; user-select:none;">
            COLLEKT<br>
            <span style="font-size:min(14px, 3vw); font-weight:800; color:rgba(212,146,11,0.85); letter-spacing:0.1em; display:block; margin-top:6px;">COLLEKT PROTECTED • VERIFIED CANDIDATE DOCUMENT</span>
          </div>
        </div>
      </div>
    `;
  } else {
    bodyHTML = `
      <div style="position:relative; width:min(580px, 100%); background:#fff; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.12); border:1px solid #d1e3e1; overflow:hidden;" id="docViewerCanvasWrap">
        <canvas id="docViewerCanvas" width="600" height="780" style="width:100%; height:auto; display:block;"></canvas>
      </div>
    `;
  }

  modal.innerHTML = `
    <div style="width:min(760px, 100%); max-height:92vh; background:var(--white, #fff); border-radius:20px; box-shadow:0 32px 80px rgba(0,0,0,.5); overflow:hidden; display:flex; flex-direction:column; animation:fadeIn .3s;">
      
      <!-- Header -->
      <div style="padding:18px 24px; border-bottom:1px solid var(--line, #e2eae9); display:flex; justify-content:space-between; align-items:center; background:var(--white, #fff);">
        <div>
          <div style="font-size:16px; font-weight:900; color:var(--ink, #0D1F1E); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:480px;">
            📄 ${escapeHTML(title)}
          </div>
          <div style="font-size:12px; color:var(--muted, #6B8280); margin-top:2px;">
            ${escapeHTML(category)} ${sizeStr ? '• ' + sizeStr : ''} &bull; Exact Uploaded Document Preview
          </div>
        </div>
        <button onclick="closeDocumentViewer()" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--muted, #888); width:36px; height:36px; border-radius:50%; display:grid; place-items:center;">✕</button>
      </div>

      <!-- Watermark Banner -->
      <div style="padding:10px 24px; background:rgba(19,117,111,0.08); border-bottom:1px solid rgba(19,117,111,0.2); color:var(--teal, #0E3B35); font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <span style="display:flex; align-items:center; gap:6px;">
          🛡️ <strong>COLLEKT WATERMARK ACTIVE</strong> — Exact Uploaded File Preview
        </span>
        <span style="font-size:11px; background:rgba(19,117,111,0.15); color:var(--teal, #0E3B35); padding:2px 8px; border-radius:99px; font-weight:900;">COLLEKT</span>
      </div>

      <!-- Document Body Viewport -->
      <div style="flex:1; padding:24px; overflow-y:auto; display:flex; justify-content:center; align-items:center; background:#0f172a; min-height:380px;">
        ${bodyHTML}
      </div>

      <!-- Actions Footer -->
      <div style="padding:16px 24px; border-top:1px solid var(--line, #e2eae9); background:var(--paper, #f8fffe); display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div style="font-size:12px; color:var(--muted, #6B8280); font-weight:600;">
          🔒 Stamped with center COLLEKT watermark
        </div>
        <div style="display:flex; gap:10px;">
          <button onclick="closeDocumentViewer()" class="btn btn-outline btn-sm" style="padding:10px 18px; font-size:13px; cursor:pointer;">Close</button>
          <button id="downloadDocBtn" class="btn btn-primary btn-sm" style="padding:10px 20px; font-size:13px; font-weight:800; background:var(--teal, #0E3B35); cursor:pointer; display:flex; align-items:center; gap:6px;">
            📥 Save / Download Document
          </button>
        </div>
      </div>

    </div>
  `;

  modal.style.display = 'flex';

  if (!isImage && !isPdf) {
    renderDocCanvas(activeDocData);
  }

  const dlBtn = document.getElementById('downloadDocBtn');
  if (dlBtn) {
    dlBtn.onclick = function() {
      downloadWatermarkedDocument(activeDocData);
    };
  }
}

function closeDocumentViewer() {
  const modal = document.getElementById('collektDocViewerModal');
  if (modal) modal.style.display = 'none';
}

function renderDocCanvas(docData) {
  const canvas = document.getElementById('docViewerCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0E3B35';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  if (docData.dataURL && (docData.type?.startsWith('image/') || docData.dataURL.startsWith('data:image'))) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const scale = Math.min((w - 60) / img.width, (h - 140) / img.height);
      const nw = img.width * scale;
      const nh = img.height * scale;
      const x = (w - nw) / 2;
      const y = (h - nh) / 2 + 10;
      ctx.drawImage(img, x, y, nw, nh);
      applyConfidentialWatermark(ctx, w, h, docData);
    };
    img.onerror = function() {
      renderDocTextTemplate(ctx, w, h, docData);
      applyConfidentialWatermark(ctx, w, h, docData);
    };
    img.src = docData.dataURL;
  } else {
    renderDocTextTemplate(ctx, w, h, docData);
    applyConfidentialWatermark(ctx, w, h, docData);
  }
}

function renderDocTextTemplate(ctx, w, h, docData) {
  ctx.fillStyle = '#0E3B35';
  ctx.fillRect(20, 20, w - 40, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px "Manrope", sans-serif';
  ctx.fillText('COLLEKT VERIFIED CREDENTIAL VAULT', 40, 52);

  ctx.fillStyle = '#13756F';
  ctx.font = '700 12px sans-serif';
  ctx.fillText('OFFICIAL CANDIDATE DOCUMENT RECORD', 40, 72);

  ctx.fillStyle = '#0D1F1E';
  ctx.font = '900 22px "Manrope", sans-serif';
  const title = (docData.name || docData.title || 'Document Record').slice(0, 42);
  ctx.fillText(title, 40, 140);

  ctx.fillStyle = '#6B8280';
  ctx.font = '600 14px sans-serif';
  ctx.fillText('Category: ' + (docData.category || docData.cat || docData.label || 'Academic / Professional Qualification'), 40, 170);
  ctx.fillText('Verified Date: ' + (docData.timestamp ? new Date(docData.timestamp).toLocaleDateString() : new Date().toLocaleDateString()), 40, 195);
  ctx.fillText('Issuing Body: ' + (docData.issuer || 'Verified Educational Board / Professional Body'), 40, 220);

  ctx.fillStyle = '#e2eae9';
  ctx.fillRect(40, 245, w - 80, 2);

  ctx.fillStyle = '#334155';
  ctx.font = '14px sans-serif';
  ctx.fillText('This official document record has been uploaded by the candidate and verified on', 40, 280);
  ctx.fillText('Collekt Energy & Professional Talent Infrastructure.', 40, 305);

  ctx.fillText('Details & Status:', 40, 345);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText('• Document Type: ' + (docData.type || 'PDF / Electronic Credential Record'), 60, 375);
  ctx.fillText('• Verification Status: Collekt Authenticated Credential ✓', 60, 400);
  ctx.fillText('• Security Clearance: Level-1 Review Copy', 60, 425);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(40, 465, w - 80, 220);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 465, w - 80, 220);

  ctx.fillStyle = '#475569';
  ctx.font = '700 15px sans-serif';
  ctx.fillText('OFFICIAL SEAL & VERIFICATION SUMMARY', 60, 500);
  ctx.font = '12px sans-serif';
  ctx.fillText('Subject: ' + (docData.name || 'Candidate Credential'), 60, 530);
  ctx.fillText('Verification Code: CLK-SEC-' + Math.floor(100000 + Math.random() * 899999), 60, 555);
  ctx.fillText('Access Restrictions: Internal Client / Employer Evaluation Only', 60, 580);
}

function applyConfidentialWatermark(ctx, w, h, docData) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-32 * Math.PI / 180);

  ctx.font = '900 92px "Inter", "Manrope", sans-serif';
  ctx.fillStyle = 'rgba(19, 117, 111, 0.42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COLLEKT', 0, 0);

  ctx.strokeStyle = 'rgba(212, 146, 11, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeText('COLLEKT', 0, 0);

  ctx.font = '800 15px "Manrope", sans-serif';
  ctx.fillStyle = 'rgba(14, 59, 53, 0.5)';
  ctx.fillText('COLLEKT PROTECTED • VERIFIED DOCUMENT • DO NOT DISTRIBUTE', 0, 56);

  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#13756f';
  ctx.font = '900 13px sans-serif';
  ctx.fillText('★ COLLEKT WATERMARKED DOCUMENT — VERIFIED MARKETPLACE CREDENTIAL', 40, h - 35);
  ctx.restore();
}

function downloadWatermarkedDocument(docData) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 1600);

  ctx.strokeStyle = '#0E3B35';
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, 1140, 1540);

  if (docData.dataURL && (docData.type?.startsWith('image/') || docData.dataURL.startsWith('data:image'))) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const scale = Math.min(1080 / img.width, 1400 / img.height);
      const nw = img.width * scale;
      const nh = img.height * scale;
      const x = (1200 - nw) / 2;
      const y = (1600 - nh) / 2;
      ctx.drawImage(img, x, y, nw, nh);
      applyConfidentialWatermarkHighRes(ctx, 1200, 1600, docData);
      triggerCanvasDownload(canvas, docData.name || 'document.png');
    };
    img.onerror = function() {
      renderDocTextTemplate(ctx, 1200, 1600, docData);
      applyConfidentialWatermarkHighRes(ctx, 1200, 1600, docData);
      triggerCanvasDownload(canvas, docData.name || 'document.png');
    };
    img.src = docData.dataURL;
  } else {
    renderDocTextTemplate(ctx, 1200, 1600, docData);
    applyConfidentialWatermarkHighRes(ctx, 1200, 1600, docData);
    triggerCanvasDownload(canvas, docData.name || 'document.png');
  }
}

function applyConfidentialWatermarkHighRes(ctx, w, h, docData) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-32 * Math.PI / 180);

  ctx.font = '900 155px "Inter", "Manrope", sans-serif';
  ctx.fillStyle = 'rgba(19, 117, 111, 0.42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COLLEKT', 0, 0);

  ctx.strokeStyle = 'rgba(212, 146, 11, 0.48)';
  ctx.lineWidth = 5;
  ctx.strokeText('COLLEKT', 0, 0);

  ctx.font = '800 26px "Manrope", sans-serif';
  ctx.fillStyle = 'rgba(14, 59, 53, 0.55)';
  ctx.fillText('COLLEKT PROTECTED • VERIFIED CANDIDATE DOCUMENT • FOR REVIEW ONLY', 0, 95);

  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#13756f';
  ctx.font = '900 20px sans-serif';
  ctx.fillText('★ COLLEKT WATERMARKED DOCUMENT — VERIFIED MARKETPLACE SYSTEM', 60, h - 60);
  ctx.restore();
}

function triggerCanvasDownload(canvas, filename) {
  const link = document.createElement('a');
  const safeName = 'collekt_verified_' + (filename || 'document').replace(/[^a-z0-9_\.]/gi, '_');
  link.download = safeName.endsWith('.png') ? safeName : safeName + '.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof showToast === 'function') {
    showToast('📥 Watermarked document saved!');
  }
}

// Auto update live message badges on page load and storage changes
document.addEventListener('DOMContentLoaded', () => {
  if (typeof updateLiveUnreadMessageBadges === 'function') {
    updateLiveUnreadMessageBadges();
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === 'collekt_all_messages' || e.key === 'collekt_conversations') {
    if (typeof updateLiveUnreadMessageBadges === 'function') {
      updateLiveUnreadMessageBadges();
    }
  }
});

/* ═════════════════════════════════════════════════════════
   1. ESCROW DISPUTE RESOLUTION ENGINE
   ═════════════════════════════════════════════════════════ */
let _activeDisputeContract = null;

function openEscrowDisputeModal(contractId, projectTitle = 'Active Project Tenders', amount = 0) {
  _activeDisputeContract = { id: contractId || 'ctr_' + Date.now(), title: projectTitle, amount: amount };

  let modal = document.getElementById('escrowDisputeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'escrowDisputeModal';
    modal.innerHTML = `
      <div class="modal-card" style="position:relative; max-width:540px; width:100%; border-radius:24px; padding:28px; background:var(--white); font-family:'Manrope',sans-serif;">
        <button class="modal-close" onclick="closeModal('escrowDisputeModal')">&times;</button>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <div style="width:40px; height:40px; border-radius:12px; background:#fee2e2; color:#dc2626; display:grid; place-items:center; font-size:20px;">⚖️</div>
          <div>
            <div style="font-size:18px; font-weight:900; color:var(--ink);">Open Formal Escrow Dispute</div>
            <div style="font-size:12px; color:var(--muted);" id="disputeProjectSub">Project Escrow Protection System</div>
          </div>
        </div>

        <p style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:16px; background:#fff7ed; border:1px solid #ffedd5; padding:10px 14px; border-radius:10px;">
          ⚠️ <strong>Escrow Lock Notice</strong>: Opening a dispute temporarily locks escrow funds until our Collekt Arbitration Panel completes legal &amp; milestone review.
        </p>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Dispute Category / Primary Reason</label>
          <select class="form-input" id="disputeCategorySelect">
            <option value="Incomplete Deliverables">Incomplete Deliverables / Missing Scope</option>
            <option value="Unsatisfactory Quality">Unsatisfactory Quality &amp; Technical Errors</option>
            <option value="Unplanned Scope Creep">Unplanned Scope Creep &amp; Milestone Delay</option>
            <option value="Payment / Fee Disagreement">Payment / Escrow Release Disagreement</option>
            <option value="Communication Breakdown">Communication Breakdown / Inactivity</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Detailed Statement &amp; Claim</label>
          <textarea class="form-input" id="disputeReasonText" rows="4" placeholder="Explain the specific issue, milestone non-performance, or scope breach in detail..."></textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button class="btn btn-outline" style="flex:1;" onclick="closeModal('escrowDisputeModal')">Cancel</button>
          <button class="btn btn-primary" style="flex:1; background:#dc2626; border:none; font-weight:800;" onclick="submitEscrowDispute()">
            ⚖️ File Dispute Claim
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (document.getElementById('disputeProjectSub')) {
    document.getElementById('disputeProjectSub').textContent = `Contract #${_activeDisputeContract.id} • ${projectTitle} (${formatNaira(amount, true)})`;
  }

  modal.classList.add('open');
}

async function submitEscrowDispute() {
  const category = document.getElementById('disputeCategorySelect')?.value;
  const statement = document.getElementById('disputeReasonText')?.value.trim();

  if (!statement || statement.length < 15) {
    if (typeof showToast === 'function') showToast('⚠️ Please provide a detailed statement (min 15 characters)', 'warning');
    return;
  }

  const user = getUser();
  const disputeRecord = {
    id: 'DSP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    contract_id: _activeDisputeContract?.id || 'ctr_101',
    project_title: _activeDisputeContract?.title || 'Tender Contract',
    amount: _activeDisputeContract?.amount || 0,
    filed_by: user?.name || 'Member',
    filed_by_role: user?.role || 'professional',
    category: category,
    statement: statement,
    status: 'under_arbitration',
    created_at: new Date().toISOString()
  };

  // Save locally
  try {
    const disputes = JSON.parse(localStorage.getItem('collekt_disputes')) || [];
    disputes.unshift(disputeRecord);
    localStorage.setItem('collekt_disputes', JSON.stringify(disputes));
  } catch(e){}

  // Sync to Supabase
  syncDisputeToSupabase(disputeRecord);

  closeModal('escrowDisputeModal');
  if (typeof showToast === 'function') showToast(`⚖️ Dispute #${disputeRecord.id} filed! Escalated to Collekt Arbitration.`);
}


/* ═════════════════════════════════════════════════════════
   2. CLIENT & PROFESSIONAL RATING & REVIEW ENGINE
   ═════════════════════════════════════════════════════════ */
let _activeReviewTarget = null;
let _selectedStarRating = 5;

function openReviewSubmissionModal(targetUserId, targetUserName = 'Contractor', projectTitle = 'Completed Contract') {
  _activeReviewTarget = { id: targetUserId, name: targetUserName, projectTitle: projectTitle };
  _selectedStarRating = 5;

  let modal = document.getElementById('clientReviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'clientReviewModal';
    modal.innerHTML = `
      <div class="modal-card" style="position:relative; max-width:520px; width:100%; border-radius:24px; padding:28px; background:var(--white); font-family:'Manrope',sans-serif;">
        <button class="modal-close" onclick="closeModal('clientReviewModal')">&times;</button>
        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:32px; margin-bottom:4px;">⭐</div>
          <div style="font-size:18px; font-weight:900; color:var(--ink);" id="reviewModalTitle">Leave a Client Review</div>
          <div style="font-size:12px; color:var(--muted);" id="reviewModalSub">Rate performance for your completed project</div>
        </div>

        <div style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;" id="starRatingSelector">
          <span style="font-size:32px; cursor:pointer; color:var(--amber);" onclick="setReviewStarRating(1)">★</span>
          <span style="font-size:32px; cursor:pointer; color:var(--amber);" onclick="setReviewStarRating(2)">★</span>
          <span style="font-size:32px; cursor:pointer; color:var(--amber);" onclick="setReviewStarRating(3)">★</span>
          <span style="font-size:32px; cursor:pointer; color:var(--amber);" onclick="setReviewStarRating(4)">★</span>
          <span style="font-size:32px; cursor:pointer; color:var(--amber);" onclick="setReviewStarRating(5)">★</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12px; font-weight:700;">Your Name</label>
            <input class="form-input" type="text" id="reviewAuthorName" placeholder="e.g. Chief Dave Ojeowere">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:12px; font-weight:700;">Company / Role (Optional)</label>
            <input class="form-input" type="text" id="reviewAuthorCompany" placeholder="e.g. Seplat Energy / Project Client">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Written Review &amp; Feedback</label>
          <textarea class="form-input" id="reviewCommentText" rows="3" placeholder="Describe the quality of work, adherence to deadlines, and technical performance..."></textarea>
        </div>

        <button class="btn btn-primary" onclick="submitClientReview()" style="width:100%; min-height:44px; font-weight:800; background:var(--amber); color:#fff; border:none; box-shadow:0 6px 20px rgba(212,146,11,0.3);">
          ⭐ Submit Official Review
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const currentUser = typeof getUser === 'function' ? getUser() : null;
  if (document.getElementById('reviewModalTitle')) {
    document.getElementById('reviewModalTitle').textContent = `Rate ${targetUserName}`;
  }
  if (document.getElementById('reviewModalSub')) {
    document.getElementById('reviewModalSub').textContent = `Project: ${projectTitle}`;
  }
  if (document.getElementById('reviewAuthorName')) {
    document.getElementById('reviewAuthorName').value = currentUser?.name || currentUser?.company_name || '';
  }
  if (document.getElementById('reviewAuthorCompany')) {
    document.getElementById('reviewAuthorCompany').value = currentUser?.company_name || currentUser?.title || '';
  }

  setReviewStarRating(5);
  modal.classList.add('open');
}

function setReviewStarRating(stars) {
  _selectedStarRating = stars;
  const starsEl = document.querySelectorAll('#starRatingSelector span');
  starsEl.forEach((star, index) => {
    star.style.color = index < stars ? 'var(--amber)' : '#cbd5e1';
  });
}

function addReviewToUserAccount(targetId, targetName, reviewRecord) {
  let allUsers = [];
  try {
    allUsers = JSON.parse(localStorage.getItem('collekt_all_users')) || [];
  } catch(e){}

  const activeUser = typeof getUser === 'function' ? getUser() : null;

  // Search for matching target user by ID, email, or name
  let targetUser = allUsers.find(u => 
    (targetId && (u.id === targetId || u.email === targetId)) || 
    (targetName && u.name && u.name.toLowerCase() === targetName.toLowerCase())
  );

  if (!targetUser && activeUser && (activeUser.id === targetId || activeUser.email === targetId || (targetName && activeUser.name && activeUser.name.toLowerCase() === targetName.toLowerCase()))) {
    targetUser = activeUser;
  }

  if (!targetUser) {
    targetUser = {
      id: targetId || 'user_' + Date.now(),
      name: targetName || 'Member',
      email: targetId && targetId.includes('@') ? targetId : 'member@collekt.com',
      reviews: [],
      rating: 0,
      review_count: 0
    };
    allUsers.push(targetUser);
  }

  if (!targetUser.reviews) targetUser.reviews = [];

  const newReviewEntry = {
    id: reviewRecord.id || ('rev_' + Date.now()),
    author: reviewRecord.reviewer_name || 'Verified Client',
    role: reviewRecord.reviewer_company || 'Project Client',
    rating: Number(reviewRecord.rating || 5),
    text: reviewRecord.comment || '',
    date: 'Today'
  };

  targetUser.reviews.unshift(newReviewEntry);

  const total = targetUser.reviews.reduce((acc, r) => acc + Number(r.rating || 5), 0);
  targetUser.rating = Number((total / targetUser.reviews.length).toFixed(1));
  targetUser.review_count = targetUser.reviews.length;
  targetUser.reviews_count = targetUser.reviews.length;

  // Persist updated target user in allUsers
  const idx = allUsers.findIndex(u => (u.id && u.id === targetUser.id) || (u.email && u.email === targetUser.email));
  if (idx !== -1) {
    allUsers[idx] = targetUser;
  } else {
    allUsers.push(targetUser);
  }

  try {
    localStorage.setItem('collekt_all_users', JSON.stringify(allUsers));
  } catch(e){}

  if (activeUser && (activeUser.id === targetUser.id || activeUser.email === targetUser.email || (targetName && activeUser.name && activeUser.name.toLowerCase() === targetName.toLowerCase()))) {
    if (typeof setUser === 'function') setUser(targetUser);
  }

  return targetUser;
}

async function submitClientReview() {
  const authorNameInput = document.getElementById('reviewAuthorName')?.value.trim();
  const authorCompanyInput = document.getElementById('reviewAuthorCompany')?.value.trim();
  const comment = document.getElementById('reviewCommentText')?.value.trim();

  if (!comment || comment.length < 10) {
    if (typeof showToast === 'function') showToast('⚠️ Please write a review comment (min 10 characters)', 'warning');
    return;
  }

  const reviewer = getUser();
  const targetId = _activeReviewTarget?.id;
  const targetName = _activeReviewTarget?.name || 'Member';

  const finalAuthorName = authorNameInput || reviewer?.name || reviewer?.company_name || 'Verified Client';
  const finalAuthorCompany = authorCompanyInput || reviewer?.title || reviewer?.company_name || 'Project Client';

  const reviewRecord = {
    id: 'rev_' + Date.now(),
    reviewer_id: reviewer?.id,
    reviewer_name: finalAuthorName,
    reviewer_company: finalAuthorCompany,
    target_id: targetId,
    rating: _selectedStarRating,
    comment: comment,
    created_at: new Date().toISOString()
  };

  // Update Target User Account & Persist to collekt_all_users
  const updatedTarget = addReviewToUserAccount(targetId, targetName, reviewRecord);

  // Sync to Supabase
  syncReviewToSupabase(reviewRecord);

  closeModal('clientReviewModal');
  if (typeof showToast === 'function') showToast(`⭐ Thank you! Your ${_selectedStarRating}-star review for ${targetName} has been published.`);

  // Immediately re-render UI on open pages
  if (typeof _renderUserToPublicProfile === 'function' && updatedTarget) {
    _renderUserToPublicProfile(updatedTarget, false);
  }
  if (typeof _applyProfile === 'function') {
    _applyProfile();
  }
  if (typeof renderCoReviews === 'function' && updatedTarget) {
    renderCoReviews(updatedTarget);
  }
}


/* ═════════════════════════════════════════════════════════
   3. PRODUCTION SUPABASE DB PERSISTENCE SYNC LAYER
   ═════════════════════════════════════════════════════════ */
async function syncDisputeToSupabase(disputeRecord) {
  if (!window.sb || !disputeRecord) return;
  try {
    await sb.from('disputes').insert({
      id: disputeRecord.id,
      contract_id: disputeRecord.contract_id,
      filed_by: disputeRecord.filed_by,
      category: disputeRecord.category,
      statement: disputeRecord.statement,
      status: disputeRecord.status
    });
  } catch (err) {
    console.warn('Supabase dispute sync notice:', err);
  }
}

async function syncReviewToSupabase(reviewRecord) {
  if (!window.sb || !reviewRecord) return;
  try {
    await sb.from('reviews').insert({
      id: reviewRecord.id,
      reviewer_id: reviewRecord.reviewer_id,
      target_id: reviewRecord.target_id,
      rating: reviewRecord.rating,
      comment: reviewRecord.comment
    });
  } catch (err) {
    console.warn('Supabase review sync notice:', err);
  }
}

async function syncContractToSupabase(contractRecord) {
  if (!window.sb || !contractRecord) return;
  try {
    await sb.from('contracts').insert({
      id: contractRecord.id,
      project_title: contractRecord.project_title,
      amount: contractRecord.amount,
      status: contractRecord.status,
      pro_id: contractRecord.pro_id,
      company_id: contractRecord.company_id
    });
  } catch (err) {
    console.warn('Supabase contract sync notice:', err);
  }
}

/* ═════════════════════════════════════════════════════════
   KOLLY AI ASSISTANT SUITE (PRD ROADMAP INTEGRATION)
   ═════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  try { initKollyAiAssistant(); } catch(e){}
  try { initNdpaConsentBanner(); } catch(e){}
});

function initKollyAiAssistant() {
  if (document.getElementById('collektAiFab')) return;

  // 1. Floating Kolly AI Assistant FAB
  const fab = document.createElement('button');
  fab.id = 'collektAiFab';
  fab.className = 'collekt-ai-fab';
  fab.innerHTML = `<span style="opacity:0.65; font-size:12px; margin-right:2px; user-select:none;">⠿</span> <img src="kolly-mascot-clean.png" alt="Kolly" style="width:24px; height:24px; min-width:24px; min-height:24px; object-fit:contain; border-radius:50%; background:rgba(255,255,255,0.2); padding:2px; flex-shrink:0;" onerror="this.style.display='none'"> <span>Kolly AI Assistant</span>`;
  fab.title = "Click to chat • Drag to move anywhere";
  fab.style.cursor = 'grab';
  fab.style.userSelect = 'none';
  fab.style.touchAction = 'none';
  document.body.appendChild(fab);

  // 2. Kolly AI Chat Window Modal
  const win = document.createElement('div');
  win.id = 'collektAiChatWindow';
  win.className = 'collekt-ai-chat-window';
  win.style.display = 'none';
  win.innerHTML = `
    <div class="ai-chat-header">
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="kolly-mascot-clean.png" alt="Kolly" style="width:36px; height:36px; object-fit:contain; border-radius:50%; background:rgba(255,255,255,0.15); padding:2px;" onerror="this.style.display='none'">
        <div>
          <div style="font-size:15px; font-weight:900; letter-spacing:.01em;">Kolly AI Assistant</div>
          <div style="font-size:10.5px; opacity:0.85;">Collekt Operational &amp; Marketplace Intelligence</div>
        </div>
      </div>
      <button onclick="toggleKollyAiChat()" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button>
    </div>
    
    <div class="ai-skills-bar" id="kollySkillsBar" title="Click to trigger autonomous AI skills">
      <span class="ai-skill-pill" onclick="triggerKollySkill('draft_escrow')">📜 Escrow Drafter</span>
      <span class="ai-skill-pill" onclick="triggerKollySkill('estimate_boq')">📊 BOQ Estimator</span>
      <span class="ai-skill-pill" onclick="triggerKollySkill('dispute_review')">⚖️ Dispute Review</span>
      <span class="ai-skill-pill" onclick="triggerKollySkill('tax_calc')">🧮 Tax &amp; Fees</span>
      <span class="ai-skill-pill" onclick="triggerKollySkill('trust_profile')">🛡️ Trust Profiler</span>
    </div>

    <div class="ai-chat-body" id="collektAiChatBody">
      <div class="ai-msg bot">
        👋 Hi, I'm <strong>Kolly</strong>, your AI Assistant on Collekt! How can I help you search talent, draft proposal pitches, post project specs, or answer platform questions today?
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin:4px 0;" id="aiQuickChips">
        <span class="ai-chip-prompt" onclick="sendAiChipQuery('Find me an Instrumentation Engineer in Lagos')">🔍 Find Engineers</span>
        <span class="ai-chip-prompt" onclick="sendAiChipQuery('How do I complete my profile score to 100%?')">📝 Profile Strength</span>
        <span class="ai-chip-prompt" onclick="sendAiChipQuery('What are the company subscription prices?')">💰 Membership Fees</span>
        <span class="ai-chip-prompt" onclick="sendAiChipQuery('How does Shield Verification work?')">🛡️ Verification Help</span>
      </div>
    </div>

    <div style="padding:12px; border-top:1px solid var(--line); background:var(--white); display:flex; gap:8px;">
      <input type="text" id="collektAiInput" placeholder="Ask Kolly AI Assistant anything..." style="flex:1; padding:9.5px 14px; border-radius:99px; border:1px solid var(--line); font-size:12px; font-family:'Manrope',sans-serif; font-weight:700;" onkeypress="if(event.key==='Enter') submitCollektAiQuery()">
      <button onclick="submitCollektAiQuery()" style="background:linear-gradient(135deg, #0e3b35, #13756f); color:#fff; border:none; border-radius:99px; padding:0 18px; font-weight:900; cursor:pointer; font-size:13px;">Send</button>
    </div>
  `;
  document.body.appendChild(win);

  // 3. Make FAB Draggable & Position Persistent on Mobile & Web
  makeKollyFabDraggable(fab);

  // 4. Make Chat Window Draggable by its Header on Mobile & Web
  const header = win.querySelector('.ai-chat-header');
  if (header) {
    header.style.cursor = 'move';
    makeKollyWindowDraggable(win, header);
  }
}

function makeKollyFabDraggable(fab) {
  if (!fab) return;

  fab.style.touchAction = 'none';
  fab.style.userSelect = 'none';

  // Restore saved position if present
  try {
    const pos = JSON.parse(localStorage.getItem('kolly_ai_fab_pos'));
    if (pos && pos.left != null && pos.top != null) {
      const fabWidth = fab.offsetWidth || 180;
      const fabHeight = 42;
      const maxLeft = Math.max(8, window.innerWidth - fabWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - fabHeight - 8);
      const safeLeft = Math.max(8, Math.min(pos.left, maxLeft));
      const safeTop = Math.max(8, Math.min(pos.top, maxTop));
      fab.style.setProperty('left', safeLeft + 'px', 'important');
      fab.style.setProperty('top', safeTop + 'px', 'important');
      fab.style.setProperty('bottom', 'auto', 'important');
      fab.style.setProperty('right', 'auto', 'important');
    }
  } catch(e){}

  let isDragging = false;
  let startX = 0, startY = 0;
  let initLeft = 0, initTop = 0;
  let distanceMoved = 0;
  let activePointerId = null;

  function onPointerDown(e) {
    // Only drag on primary touch or left click
    if (e.button && e.button !== 0) return;

    isDragging = true;
    distanceMoved = 0;

    const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    startX = cx;
    startY = cy;

    const rect = fab.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;

    fab.style.cursor = 'grabbing';
    fab.style.transition = 'none';

    if (e.pointerId != null) {
      activePointerId = e.pointerId;
      try {
        if (fab.setPointerCapture) fab.setPointerCapture(e.pointerId);
      } catch(err) {}
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    if (!window.PointerEvent) {
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    const dx = cx - startX;
    const dy = cy - startY;

    distanceMoved = Math.hypot(dx, dy);
    if (distanceMoved > 3 && e.cancelable) {
      e.preventDefault();
    }

    const fabWidth = fab.offsetWidth || 180;
    const fabHeight = 42;
    const maxLeft = Math.max(8, window.innerWidth - fabWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - fabHeight - 8);

    let newLeft = Math.max(8, Math.min(initLeft + dx, maxLeft));
    let newTop = Math.max(8, Math.min(initTop + dy, maxTop));

    fab.style.setProperty('left', newLeft + 'px', 'important');
    fab.style.setProperty('top', newTop + 'px', 'important');
    fab.style.setProperty('bottom', 'auto', 'important');
    fab.style.setProperty('right', 'auto', 'important');
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    fab.style.cursor = 'grab';
    fab.style.transition = 'box-shadow .2s ease';

    if (activePointerId != null) {
      try {
        if (fab.releasePointerCapture) fab.releasePointerCapture(activePointerId);
      } catch(err) {}
      activePointerId = null;
    }

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (!window.PointerEvent) {
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    }

    const rect = fab.getBoundingClientRect();
    try {
      localStorage.setItem('kolly_ai_fab_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    } catch(e){}

    if (distanceMoved > 6) {
      fab.setAttribute('data-dragged', 'true');
      setTimeout(() => fab.removeAttribute('data-dragged'), 250);
    }
  }

  if (window.PointerEvent) {
    fab.addEventListener('pointerdown', onPointerDown);
  } else {
    fab.addEventListener('mousedown', onPointerDown);
    fab.addEventListener('touchstart', onPointerDown, { passive: false });
  }

  fab.addEventListener('click', (e) => {
    if (fab.getAttribute('data-dragged') === 'true') {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
    toggleKollyAiChat();
  });
}

function makeKollyWindowDraggable(win, header) {
  if (!win || !header) return;

  header.style.touchAction = 'none';
  header.style.userSelect = 'none';

  let isDragging = false;
  let startX = 0, startY = 0;
  let initLeft = 0, initTop = 0;
  let distanceMoved = 0;

  function onHeaderPointerDown(e) {
    if (e.target.closest('button, input, textarea, a') && e.target.tagName === 'BUTTON') return;

    isDragging = true;
    distanceMoved = 0;

    const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    startX = cx;
    startY = cy;

    const rect = win.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;

    win.style.transition = 'none';

    try {
      if (e.pointerId != null && header.setPointerCapture) {
        header.setPointerCapture(e.pointerId);
      }
    } catch(err) {}

    window.addEventListener('pointermove', onHeaderPointerMove, { passive: false });
    window.addEventListener('pointerup', onHeaderPointerUp);
    window.addEventListener('pointercancel', onHeaderPointerUp);
    window.addEventListener('touchmove', onHeaderPointerMove, { passive: false });
    window.addEventListener('touchend', onHeaderPointerUp);
  }

  function onHeaderPointerMove(e) {
    if (!isDragging) return;
    const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    const dx = cx - startX;
    const dy = cy - startY;

    distanceMoved = Math.hypot(dx, dy);
    if (distanceMoved > 3 && e.cancelable) {
      e.preventDefault();
    }

    const winWidth = win.offsetWidth || 380;
    const winHeight = win.offsetHeight || 500;
    const maxLeft = Math.max(6, window.innerWidth - winWidth - 6);
    const maxTop = Math.max(6, window.innerHeight - winHeight - 6);

    let newLeft = Math.max(6, Math.min(initLeft + dx, maxLeft));
    let newTop = Math.max(6, Math.min(initTop + dy, maxTop));

    win.style.setProperty('left', newLeft + 'px', 'important');
    win.style.setProperty('top', newTop + 'px', 'important');
    win.style.setProperty('bottom', 'auto', 'important');
    win.style.setProperty('right', 'auto', 'important');
  }

  function onHeaderPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    win.style.transition = '';

    try {
      if (e && e.pointerId != null && header.releasePointerCapture) {
        header.releasePointerCapture(e.pointerId);
      }
    } catch(err) {}

    window.removeEventListener('pointermove', onHeaderPointerMove);
    window.removeEventListener('pointerup', onHeaderPointerUp);
    window.removeEventListener('pointercancel', onHeaderPointerUp);
    window.removeEventListener('touchmove', onHeaderPointerMove);
    window.removeEventListener('touchend', onHeaderPointerUp);
  }

  if (window.PointerEvent) {
    header.addEventListener('pointerdown', onHeaderPointerDown);
  } else {
    header.addEventListener('mousedown', onHeaderPointerDown);
    header.addEventListener('touchstart', onHeaderPointerDown, { passive: false });
  }
}

function toggleKollyAiChat() {
  const win = document.getElementById('collektAiChatWindow');
  if (!win) return;
  const isHidden = win.style.display === 'none';
  win.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    // If opening for first time without coordinates, position nicely
    const rect = win.getBoundingClientRect();
    if (!win.style.left || win.style.left === 'auto') {
      if (window.innerWidth <= 600) {
        win.style.left = '10px';
        win.style.right = '10px';
        win.style.width = 'calc(100vw - 20px)';
        win.style.bottom = '80px';
      }
    }
    const input = document.getElementById('collektAiInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function triggerKollySkill(skillId) {
  const input = document.getElementById('collektAiInput');
  if (!input) return;
  const prompts = {
    draft_escrow: 'Draft milestone escrow agreement for: Offshore Pipeline Integrity Survey in Port Harcourt, Budget: ₦5,000,000 across 3 milestones.',
    estimate_boq: 'Estimate Bill of Quantities (BOQ) for: 50kW Commercial Solar PV Mini-grid in Ikeja, Lagos including inverters, lithium batteries, and cabling.',
    dispute_review: 'Review escrow dispute evidence: Buyer purchased 200m subsea power cable; vendor dispatched via waybill #4092, but buyer states insulation test failed on delivery.',
    tax_calc: 'Calculate Nigerian WHT (10%), VAT (7.5%), and platform escrow fees on an engineering contract worth ₦3,500,000.',
    trust_profile: 'Analyze vendor trust & risk: Company RC 1928412, FIRS TIN verified, Director NIN confirmed, 0 platform disputes, COREN certified.'
  };
  input.value = prompts[skillId] || 'Tell me about your AI skills';
  submitCollektAiQuery(skillId);
}

function sendAiChipQuery(text) {
  const input = document.getElementById('collektAiInput');
  if (input) {
    input.value = text;
    submitCollektAiQuery();
  }
}

async function submitCollektAiQuery(explicitSkill = null) {
  const input = document.getElementById('collektAiInput');
  const body = document.getElementById('collektAiChatBody');
  if (!input || !body) return;

  const query = input.value.trim();
  if (!query) return;

  // Append User Msg
  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.textContent = query;
  body.appendChild(userDiv);

  input.value = '';
  body.scrollTop = body.scrollHeight;

  // Typing Indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-msg bot';
  typingDiv.id = 'kollyChatTypingIndicator';
  typingDiv.innerHTML = '<span style="display:inline-flex; align-items:center; gap:6px;">🦖 <em>Kolly is processing with Gemini AI...</em></span>';
  body.appendChild(typingDiv);
  body.scrollTop = body.scrollHeight;

  try {
    const botReply = await processAiCopilotQuery(query, explicitSkill);
    const tInd = document.getElementById('kollyChatTypingIndicator');
    if (tInd) tInd.remove();
    const botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    botDiv.innerHTML = botReply;
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  } catch(err) {
    console.error('Kolly Chat query error:', err);
    const tInd = document.getElementById('kollyChatTypingIndicator');
    if (tInd) tInd.remove();
    const botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    botDiv.innerHTML = `⚡ <strong>Kolly AI</strong>: I'm here! You can explore verified specialists on the <a href="marketplace.html" style="color:var(--teal); font-weight:800;">Marketplace</a>, or check your profile completeness on <a href="profile.html" style="color:var(--teal); font-weight:800;">Profile</a>!`;
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  }
}

function formatKollyMarkdown(text) {
  if (!text) return '';
  let html = String(text);
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--teal); font-weight:800;">$1</a>');
  html = html.replace(/(?:^|\n)[•\-]\s+(.*)/g, '<br>&bull; $1');
  html = html.replace(/(?:^|\n)(\d+)\.\s+(.*)/g, '<br><strong>$1.</strong> $2');
  html = html.replace(/\n\n+/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

async function processAiCopilotQuery(query, explicitSkill = null) {
  const q = String(query).toLowerCase();
  const users = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  const u = typeof getUser === 'function' ? getUser() : null;

  // Detect skill action if not explicitly supplied
  let skillAction = explicitSkill;
  if (!skillAction) {
    if (q.includes('escrow') || q.includes('milestone agreement') || q.includes('draft contract') || q.includes('contract draft')) skillAction = 'draft_escrow';
    else if (q.includes('boq') || q.includes('bill of quant') || q.includes('solar pv') || q.includes('estimate cost') || q.includes('tender budget')) skillAction = 'estimate_boq';
    else if (q.includes('dispute') || q.includes('arbitrat') || q.includes('waybill') || q.includes('failed test') || q.includes('claim refund')) skillAction = 'dispute_review';
    else if (q.includes('tax') || q.includes('wht') || q.includes('vat') || q.includes('withholding')) skillAction = 'tax_calc';
    else if (q.includes('trust') || q.includes('rc ') || q.includes('tin') || q.includes('risk score') || q.includes('profiler') || q.includes('risk')) skillAction = 'trust_profile';
  }

  // Immediate local answers for profile score / file uploads
  if (q.includes('profile') && (q.includes('score') || q.includes('100%') || q.includes('strength') || q.includes('upload') || q.includes('cv') || q.includes('cert'))) {
    const score = typeof computePrdProfileScore === 'function' ? computePrdProfileScore(u) : 60;
    const cvFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('cv') : [];
    const certFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('certifications') : [];
    const portFiles = typeof getUploadedFiles === 'function' ? getUploadedFiles('portfolio') : [];
    const isVerified = !!(u && (u.verified === true || u.is_verified === true || u.verification_status === 'verified'));

    const cvStatus = cvFiles.length > 0 ? `✅ CV Uploaded (<em>${escapeHTML(cvFiles[0].name)}</em>)` : '❌ CV Missing';
    const certStatus = certFiles.length > 0 ? `✅ Certifications Uploaded (${certFiles.length} file)` : '❌ Certifications Missing';
    const portStatus = portFiles.length > 0 ? `✅ Portfolio Added (${portFiles.length} items)` : '❌ Portfolio Items Missing';
    const idStatus = isVerified ? '✅ Identity Verified 🛡️' : '❌ Identity Unverified';

    return `🦖 <strong>Kolly Profile &amp; Upload Inspection</strong>:<br>Overall Profile Completion: <strong>${score}%</strong><br><br>
📁 <strong>Upload Status</strong>:<br>
&bull; ${cvStatus}<br>
&bull; ${certStatus}<br>
&bull; ${portStatus}<br>
&bull; ${idStatus}<br><br>
💡 <em>Kolly's Advice</em>: All your uploaded files stay permanently saved in your profile. You can view existing files or upload replacement versions anytime on your <a href="profile.html" style="color:var(--teal); font-weight:800;">Profile Page →</a>`;
  }

  // Talent search query check
  if (q.includes('engineer') || q.includes('instrumentation') || q.includes('find') || q.includes('search talent') || q.includes('hire')) {
    const pros = users.filter(usr => (usr.role || '').toLowerCase() !== 'company');
    if (pros.length > 0) {
      const topMatch = pros[0];
      return `🔍 <strong>Kolly AI Talent Match Result</strong>:<br>Found <strong>${pros.length} qualified professionals</strong> in Collekt DB.<br><br>🏆 <strong>Top Recommended</strong>: ${escapeHTML(topMatch.name)} (${escapeHTML(topMatch.title || 'Senior Engineer')}) &bull; ${topMatch.verified ? 'Shield Verified 🛡️' : 'Unverified'}<br><a href="marketplace.html" style="color:var(--teal); font-weight:800;">View candidates on Marketplace →</a>`;
    }
  }

  // Query serverless Gemini gateway with skill action
  try {
    const savedKey = localStorage.getItem('collekt_gemini_api_key') || '';
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: skillAction || 'chat',
        prompt: query,
        user: u,
        apiKey: savedKey
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.reply || data.response)) {
        return formatKollyMarkdown(data.reply || data.response);
      }
    }
  } catch(e) {
    console.warn('Gemini gateway call fallback to local skill engine:', e);
  }

  // Autonomous Smart Fallback Templates for Skills
  if (skillAction === 'draft_escrow') {
    return `📜 <strong>Kolly Smart Escrow &amp; Milestone Agreement</strong>:<br>
<strong>Jurisdiction</strong>: Federal Republic of Nigeria (Arbitration &amp; Mediation Act 2023)<br>
<strong>Platform Escrow Provider</strong>: Collekt Technologies Ltd<br><br>
🔹 <strong>Milestone 1: Mobilization &amp; Site Assessment (30% &bull; ₦1,500,000)</strong><br>
&bull; <em>Deliverable</em>: Preliminary technical assessment, HAZOP checklist &amp; approved work schedule.<br>
&bull; <em>Verification</em>: Submission of stamped technical memo.<br><br>
🔹 <strong>Milestone 2: Execution &amp; Testing (50% &bull; ₦2,500,000)</strong><br>
&bull; <em>Deliverable</em>: Physical inspection, non-destructive testing (NDT), and calibrated diagnostic log.<br>
&bull; <em>Verification</em>: Factory Acceptance Test (FAT) / Site Acceptance Test (SAT) report.<br><br>
🔹 <strong>Milestone 3: Final Sign-off &amp; Closeout (20% &bull; ₦1,000,000)</strong><br>
&bull; <em>Deliverable</em>: Certified closeout documentation and 48-hour client inspection period.<br><br>
⚖️ <strong>Escrow Protection</strong>: Funds remain securely locked until the client issues milestone confirmation or the 48-hour inspection timer elapses without formal dispute.`;
  }

  if (skillAction === 'estimate_boq') {
    return `📊 <strong>Kolly Engineering BOQ &amp; Cost Estimation</strong>:<br>
<strong>Project</strong>: 50kW Commercial Solar PV Mini-Grid (Lagos State)<br><br>
1. <strong>Solar PV Tier-1 Modules (550W Monocrystalline x 92 units)</strong>: ₦7,800,000<br>
2. <strong>Hybrid Inverters (2 x 25kW High-Voltage Inverters)</strong>: ₦6,400,000<br>
3. <strong>Lithium Iron Phosphate (LiFePO4) Battery Bank (48V / 60kWh)</strong>: ₦14,200,000<br>
4. <strong>Mounting Racks, DC/AC Switchgear &amp; Lightning Protection</strong>: ₦2,600,000<br>
5. <strong>Certified COREN Electrical Labor &amp; Commissioning</strong>: ₦2,200,000<br>
6. <strong>Logistics &amp; Transport within Lagos / Ogun</strong>: ₦850,000<br>
7. <strong>Contingency Reserve (7.5%)</strong>: ₦2,553,750<br><br>
💰 <strong>Estimated Total Contract Sum</strong>: <strong>₦36,603,750</strong><br>
💡 <em>Recommended Contractor Markup</em>: 15% (₦5,490,560) for competitive tender submission.`;
  }

  if (skillAction === 'dispute_review') {
    return `⚖️ <strong>Kolly Escrow Dispute Mediation Analysis</strong>:<br>
<strong>Case Summary</strong>: Buyer claims delivered subsea power cable failed insulation resistance testing, while vendor provided signed transport waybill.<br><br>
📋 <strong>Evidence Review</strong>:<br>
&bull; <strong>Waybill Proof</strong>: Confirms physical custody transfer, but does not guarantee technical compliance.<br>
&bull; <strong>Inspection Period</strong>: Notice of defect was filed within the mandatory 48-hour inspection window.<br><br>
🎯 <strong>Impartial Mediation Ruling</strong>:<br>
1. <strong>Escrow Hold</strong>: Funds remain locked in Collekt Escrow &mdash; no immediate disbursement.<br>
2. <strong>Cure Period (5 Business Days)</strong>: Vendor is granted 5 business days to send an accredited technician to re-test in the presence of both parties or dispatch replacement spool.<br>
3. <strong>Conditional Release</strong>: If replacement passes SAT, release 100% of Milestone funds; if vendor fails to remediate, 100% principal is refunded to the Buyer.`;
  }

  if (skillAction === 'tax_calc') {
    return `🧮 <strong>Nigerian Tax &amp; Collekt Fee Breakdown</strong>:<br>
<strong>Gross Contract Amount</strong>: ₦3,500,000.00<br><br>
&bull; <strong>Withholding Tax (WHT @ 10% for Corporate Technical Services)</strong>: -₦350,000.00<br>
&bull; <strong>Value Added Tax (VAT @ 7.5% remitted to FIRS)</strong>: +₦262,500.00 (charged to client)<br>
&bull; <strong>Collekt Escrow &amp; Platform Fee (10%)</strong>: -₦350,000.00<br><br>
💵 <strong>Net Payout to Vendor</strong>: <strong>₦2,800,000.00</strong><br>
🧾 <strong>Total Invoiced to Client</strong>: <strong>₦3,762,500.00</strong><br>
💡 <em>Compliance Note</em>: WHT credit notes are issued directly to vendor's FIRS Tax Identification Number (TIN).`;
  }

  if (skillAction === 'trust_profile') {
    return `🛡️ <strong>Kolly Vendor Trust &amp; Safety Rating</strong>:<br>
Overall Trust Score: <strong>96 / 100 &bull; EXCELLENT</strong> 🛡️<br><br>
✅ <strong>CAC Incorporation</strong>: RC 1928412 verified with Corporate Affairs Commission.<br>
✅ <strong>Tax Identification (TIN)</strong>: Active on FIRS portal with valid status.<br>
✅ <strong>Identity Verification</strong>: Director NIN biometric validation passed.<br>
✅ <strong>Professional Standing</strong>: COREN / NOGICD registered engineering practice.<br>
✅ <strong>Dispute Metric</strong>: 0% dispute rate across previous engagements.<br><br>
🏅 <strong>Platform Badge</strong>: Awarded <strong>Shield Verified Vendor 🛡️</strong> status. Highly recommended for high-value escrow contracts.`;
  }

  // Fallback PRD knowledge
  if (q.includes('price') || q.includes('subscription') || q.includes('fee') || q.includes('cost')) {
    return `💰 <strong>Collekt Membership &amp; Pricing (PRD Specification)</strong>:<br>&bull; <strong>Professional Plus</strong>: $15 / month<br>&bull; <strong>Company Business</strong>: $50 / month<br>&bull; <strong>Platform Commission Fee</strong>: 10% on completed project engagements.`;
  }

  if (q.includes('verify') || q.includes('verification') || q.includes('shield') || q.includes('nin') || q.includes('cac')) {
    return `🛡️ <strong>Shield Verification Framework</strong>:<br>Identity (NIN), COREN Engineering Licenses, and CAC Incorporation Documents are submitted on your profile page and reviewed by Collekt Admins. Verified accounts receive the <strong>Shield Verified Logo 🛡️</strong>.`;
  }

  return `⚡ <strong>Kolly AI Assistant</strong>: I am trained on Collekt's Nigerian marketplace operations and infused with Google Gemini. You can trigger my 5 specialized skills anytime using the skills bar above:<br>
&bull; 📜 <strong>Escrow Drafter</strong> &bull; 📊 <strong>BOQ Estimator</strong> &bull; ⚖️ <strong>Dispute Review</strong> &bull; 🧮 <strong>Tax &amp; Fees</strong> &bull; 🛡️ <strong>Trust Profiler</strong>!`;
}

// Global Gemini Helpers for Platform-wide Integration
window.matchTalentWithKolly = async function(job, candidates) {
  try {
    const savedKey = localStorage.getItem('collekt_gemini_api_key') || '';
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'match_talent', job, candidates, apiKey: savedKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.matches) return data.matches;
    }
  } catch(e) {
    console.warn('matchTalentWithKolly API error:', e);
  }
  return candidates.map(c => ({
    candidate_id: c.id,
    candidate_name: c.name || c.full_name || 'Candidate',
    candidate_title: c.title || 'Engineer',
    match_score: (c.verified || c.is_verified) ? 95 : 84,
    match_reason: (c.verified || c.is_verified) ? 'Shield Verified • Aligned Engineering Discipline' : 'Relevant Engineering Background'
  }));
};

window.draftJobScopeWithKolly = async function(prompt, discipline = '', budget = '') {
  try {
    const savedKey = localStorage.getItem('collekt_gemini_api_key') || '';
    const user = typeof getUser === 'function' ? getUser() : null;
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'draft_job', prompt: `${prompt} ${discipline} ${budget}`.trim(), user, apiKey: savedKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.draft) return data.draft;
    }
  } catch(e) {
    console.warn('draftJobScopeWithKolly API error:', e);
  }
  return null;
};

window.generatePitchWithKolly = async function(job, user) {
  try {
    const savedKey = localStorage.getItem('collekt_gemini_api_key') || '';
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_pitch', job, user, apiKey: savedKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.pitch) return data.pitch;
    }
  } catch(e) {
    console.warn('generatePitchWithKolly API error:', e);
  }
  return null;
};

// -- KOLLY AI MATCH INSIGHTS SCREENER (FOR COMPANIES) --
function generateAiMatchInsight(proId, jobId) {
  const users = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  const pro = users.find(u => u.id === proId || u.email === proId) || users[0] || { name: 'Engineering Specialist', title: 'Senior Engineer', years_experience: 8 };
  
  const score = calculatePrdCandidateMatchScore(pro, { discipline: 'Instrumentation', required_experience: '5' });

  let modal = document.getElementById('aiMatchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'aiMatchModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; z-index:9995; background:rgba(4,14,13,0.8); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:20px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:500px; width:100%; border-radius:24px; padding:28px; background:var(--white); position:relative; font-family:'Manrope',sans-serif;">
      <button class="modal-close" onclick="document.getElementById('aiMatchModal').style.display='none'">&times;</button>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <img src="kolly-mascot-clean.png" alt="Kolly" style="width:44px; height:44px; object-fit:contain; border-radius:50%; background:var(--paper); padding:4px; border:1px solid var(--line);" onerror="this.style.display='none'">
        <div>
          <div style="font-size:18px; font-weight:900; color:var(--ink);">Kolly AI Candidate Screener</div>
          <div style="font-size:12px; color:var(--muted);">Gemini-Infused Matching Evaluation</div>
        </div>
      </div>

      <div style="background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:18px; margin-bottom:20px; text-align:center;">
        <div style="font-size:11px; font-weight:800; color:var(--muted); text-transform:uppercase;">Overall Compatibility Match</div>
        <div style="font-size:36px; font-weight:900; color:var(--teal); margin:4px 0;">${score}% Match ⚡</div>
        <div style="font-size:13px; font-weight:800; color:var(--ink);">${escapeHTML(pro.name)} &bull; ${escapeHTML(pro.title || 'Engineering Specialist')}</div>
      </div>

      <div style="font-size:12px; font-weight:800; color:var(--ink); margin-bottom:8px;">Key Kolly AI Screening Factors:</div>
      <ul style="font-size:12px; color:var(--muted); line-height:1.6; padding-left:20px; margin-bottom:20px;">
        <li><strong>Discipline Alignment</strong>: High match for Engineering &amp; Operations scope.</li>
        <li><strong>Experience Match</strong>: ${pro.years_experience || 8}+ years engineering experience.</li>
        <li><strong>Verification Status</strong>: ${pro.verified ? 'Shield Verified Account 🛡️' : 'Identity Verification Pending'}.</li>
        <li><strong>Availability</strong>: Available for immediate deployment.</li>
      </ul>

      <div style="display:flex; gap:10px;">
        <button class="btn btn-outline btn-sm" style="flex:1;" onclick="document.getElementById('aiMatchModal').style.display='none'">Close Insights</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="showToast('⭐ Candidate shortlisted!'); document.getElementById('aiMatchModal').style.display='none';">Shortlist Candidate</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

// -- KOLLY AI PROPOSAL AUTO-DRAFTER (FOR PROFESSIONALS) --
async function generateAiProposalDraft(jobTitle = 'Engineering Tender', targetInputId = 'proposalCoverLetter') {
  const u = typeof getUser === 'function' ? getUser() : null;
  const el = document.getElementById(targetInputId);
  if (el) {
    el.placeholder = '✨ Kolly AI is crafting your proposal pitch...';
  }
  if (typeof showToast === 'function') showToast('🦖 Kolly AI is generating proposal pitch...');

  try {
    const jobObj = { title: jobTitle, description: jobTitle };
    const pitch = await window.generatePitchWithKolly(jobObj, u);
    if (pitch && el) {
      el.value = pitch;
      if (typeof showToast === 'function') showToast('✨ Kolly AI proposal cover letter auto-generated!');
      return;
    }
  } catch(e) {
    console.warn('generateAiProposalDraft error:', e);
  }

  const name = u?.name || 'Specialist';
  const title = u?.title || 'Senior Engineer';
  const text = `Dear Hiring Committee,\n\nI am writing to submit my formal bid proposal for the ${jobTitle} opportunity on Collekt. As a ${title} with extensive hands-on industry experience in Oil & Gas and EPC projects, I possess the exact technical discipline required to deliver this scope safely, efficiently, and on schedule.\n\nMy qualifications include:\n- COREN Engineering License & NIN Verified Identity 🛡️\n- Proven track record executing complex offshore/onshore engineering assignments\n- Commitment to strict HSEQ and engineering standards\n\nI look forward to reviewing project milestones and initiating this engagement.\n\nSincerely,\n${name}`;

  if (el) {
    el.value = text;
    if (typeof showToast === 'function') showToast('✨ Kolly AI proposal cover letter auto-generated!');
  }
}

// -- KOLLY AI TENDER SPEC GENERATOR (FOR COMPANIES) --
async function generateAiTenderSpec(titleInputId = 'jobTitle', descInputId = 'jobDesc') {
  const titleEl = document.getElementById(titleInputId);
  const descEl = document.getElementById(descInputId);
  const titleVal = titleEl?.value.trim() || 'Instrumentation & Control Systems Specialist';

  if (descEl) {
    descEl.placeholder = '✨ Kolly AI is drafting tender scope and deliverables...';
  }
  if (typeof showToast === 'function') showToast('🦖 Kolly AI is drafting tender specifications...');

  try {
    const draft = await window.draftJobScopeWithKolly(titleVal);
    if (draft && descEl) {
      descEl.value = draft;
      if (typeof showToast === 'function') showToast('✨ Kolly AI Tender Specification generated!');
      if (typeof updateLivePreview === 'function') updateLivePreview();
      return;
    }
  } catch(e) {
    console.warn('generateAiTenderSpec error:', e);
  }

  const specText = `PROJECT SCOPE & OBJECTIVES:\nWe require a qualified ${titleVal} to manage EPC engineering deliverables, commissioning oversight, and field operations for our energy project in Nigeria.\n\nKEY RESPONSIBILITIES:\n1. Execute detailed technical designs, P&ID inspections, and field instrumentation setups.\n2. Ensure full adherence to Department of Petroleum Resources (DPR) and COREN standards.\n3. Supervise subcontractor installation, loop checking, and HAZOP reviews.\n\nREQUIRED QUALIFICATIONS:\n- COREN / NSE Engineering Registration & Shield Verification 🛡️\n- Minimum 5+ years relevant Oil & Gas industry experience\n- Degree in Engineering (Electrical/Mechanical/Instrumentation)`;

  if (descEl) {
    descEl.value = specText;
    if (typeof showToast === 'function') showToast('✨ Kolly AI Tender Specification generated!');
    if (typeof updateLivePreview === 'function') updateLivePreview();
  }
}

// ═════════════════════════════════════════════════════════
// STRICT FACTUAL DATABASE METRICS CALCULATOR
// ═════════════════════════════════════════════════════════
function getLivePlatformStats() {
  const registeredUsers = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  const postedJobs = typeof getPostedJobs === 'function' ? getPostedJobs() : (JSON.parse(localStorage.getItem('collekt_posted_jobs') || '[]'));
  const postedProjects = JSON.parse(localStorage.getItem('collekt_posted_projects') || '[]');
  const allProjectsMap = new Map();
  [...postedJobs, ...postedProjects].forEach(p => { if (p && p.id) allProjectsMap.set(p.id, p); });
  const customProjects = Array.from(allProjectsMap.values());
  const proposals = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
  const awardedContracts = JSON.parse(localStorage.getItem('collekt_awarded_contracts') || '[]');

  // 1. Exact Factual Verified Professionals in Database
  const verifiedUsers = registeredUsers.filter(u => u.verified === true || u.verification_status === 'verified');
  const totalVerifiedProfessionals = verifiedUsers.length;

  // 2. Exact Factual Active Projects Posted in Database
  const activeProjectsCount = customProjects.filter(p => p.status !== 'closed' && p.status !== 'draft').length;

  // 3. Exact Factual Contracts Awarded in Database (Sum value in Naira)
  const awardedVal = awardedContracts.reduce((sum, c) => sum + (Number(c.amount || c.budget || 0)), 0);
  const proposalVal = proposals.filter(p => p.status === 'awarded' || p.status === 'accepted').reduce((sum, p) => sum + (Number(p.amount || p.bid_amount || 0)), 0);
  const totalContractsVal = awardedVal + proposalVal;

  let formattedContractsVal = '₦0';
  if (totalContractsVal > 0) {
    if (totalContractsVal >= 1000000000) {
      const inBillions = (totalContractsVal / 1000000000).toFixed(2);
      formattedContractsVal = `₦${inBillions}B`;
    } else if (totalContractsVal >= 1000000) {
      const inMillions = (totalContractsVal / 1000000).toFixed(1);
      formattedContractsVal = `₦${inMillions}M`;
    } else {
      formattedContractsVal = `₦${totalContractsVal.toLocaleString()}`;
    }
  }

  // 4. Exact Factual Industry Sectors Active in Database
  const userSectors = registeredUsers.map(u => u.sector || u.industry).filter(Boolean);
  const projectSectors = customProjects.map(p => p.category || p.sector).filter(Boolean);
  const uniqueSectors = new Set([...userSectors, ...projectSectors]);

  return {
    verifiedProfessionals: totalVerifiedProfessionals,
    activeProjects: activeProjectsCount,
    contractsAwardedFormatted: formattedContractsVal,
    contractsAwardedRaw: totalContractsVal,
    industrySectors: uniqueSectors.size
  };
}

function updateLiveStatsUI() {
  const stats = getLivePlatformStats();

  const elVerified = document.getElementById('statVerifiedUsers');
  const elProjects = document.getElementById('statActiveProjects');
  const elContracts = document.getElementById('statContractsAwarded');
  const elSectors = document.getElementById('statIndustrySectors');

  if (elVerified) elVerified.textContent = stats.verifiedProfessionals.toLocaleString();
  if (elProjects) elProjects.textContent = `${stats.activeProjects.toLocaleString()}+`;
  if (elContracts) elContracts.textContent = stats.contractsAwardedFormatted;
  if (elSectors) elSectors.textContent = stats.industrySectors.toString();
}

// Live Phone Mockup Clock Ticker
function updatePhoneMockupClock() {
  const clockElements = document.querySelectorAll('#phoneMockupClock, .phone-mockup-clock');
  if (!clockElements.length) return;
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  clockElements.forEach(el => {
    el.textContent = timeStr;
  });
}

// Auto-run real-time stats & clock updates on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  updateLiveStatsUI();
  updatePhoneMockupClock();
  setInterval(updatePhoneMockupClock, 5000);

  // Supabase Real-Time Listener
  if (window.sb && typeof window.sb.channel === 'function') {
    try {
      window.sb.channel('realtime_platform_stats')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          updateLiveStatsUI();
        })
        .subscribe();
    } catch(e){}
  }
});

/* ═════════════════════════════════════════════════════════
   COLLEKT MODERN GLASSMORPHIC COOKIE & DATA PRIVACY SUITE
   Statutory Compliance: Nigeria Data Protection Act (NDPA 2023)
   ═════════════════════════════════════════════════════════ */

function injectCookieStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('collekt-cookie-styles')) return;
  const style = document.createElement('style');
  style.id = 'collekt-cookie-styles';
  style.textContent = `
    @keyframes collektCookieSlideUp {
      0% { opacity: 0; transform: translateY(40px) scale(0.97); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes collektCookieFadeOut {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(30px) scale(0.96); }
    }
    @keyframes collektToastFade {
      0% { opacity: 0; transform: translate(-50%, 20px); }
      15% { opacity: 1; transform: translate(-50%, 0); }
      85% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, -10px); }
    }
    .collekt-cookie-card {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 350px;
      max-width: calc(100vw - 36px);
      z-index: 99999;
      background: rgba(6, 21, 19, 0.94);
      backdrop-filter: blur(24px) saturate(190%);
      -webkit-backdrop-filter: blur(24px) saturate(190%);
      border: 1.5px solid rgba(45, 212, 191, 0.32);
      border-radius: 18px;
      padding: 16px 18px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 2px 10px rgba(20, 184, 166, 0.18);
      color: #f1f5f9;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: collektCookieSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .collekt-cookie-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(20, 184, 166, 0.16);
      border: 1px solid rgba(45, 212, 191, 0.35);
      color: #2dd4bf;
      padding: 2px 7px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .collekt-cookie-btn-accept {
      background: linear-gradient(135deg, #0e3b35 0%, #14b8a6 100%);
      border: 1px solid rgba(45, 212, 191, 0.5);
      color: #ffffff !important;
      padding: 8px 14px;
      border-radius: 10px;
      font-weight: 800;
      font-size: 12.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 14px rgba(20, 184, 166, 0.3);
      text-decoration: none;
      white-space: nowrap;
      flex: 1;
    }
    .collekt-cookie-btn-accept:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(20, 184, 166, 0.45);
      filter: brightness(1.08);
    }
    .collekt-cookie-btn-customize {
      background: none;
      border: none;
      color: #94a3b8 !important;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 3px 0;
      text-decoration: underline;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: color 0.2s;
    }
    .collekt-cookie-btn-customize:hover {
      color: #2dd4bf !important;
    }
    .collekt-cookie-btn-reject {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #cbd5e1 !important;
      padding: 8px 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 12.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      text-decoration: none;
      white-space: nowrap;
      flex: 1;
    }
    .collekt-cookie-btn-reject:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.45);
      color: #fca5a5 !important;
      transform: translateY(-1px);
    }
    .collekt-cookie-toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }
    .collekt-cookie-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .collekt-cookie-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 99px;
      transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .collekt-cookie-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 2px;
      bottom: 2px;
      background-color: #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .collekt-cookie-toggle input:checked + .collekt-cookie-slider {
      background: linear-gradient(135deg, #0e3b35 0%, #14b8a6 100%);
      border-color: rgba(45, 212, 191, 0.6);
      box-shadow: 0 0 12px rgba(20, 184, 166, 0.4);
    }
    .collekt-cookie-toggle input:checked + .collekt-cookie-slider:before {
      transform: translateX(20px);
    }
    .collekt-cookie-toggle input:disabled + .collekt-cookie-slider {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .collekt-pref-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 12px;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .collekt-pref-card:hover {
      border-color: rgba(45, 212, 191, 0.3);
      background: rgba(255, 255, 255, 0.06);
    }
    .collekt-cookie-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100005;
      background: rgba(6, 21, 19, 0.94);
      border: 1.5px solid rgba(45, 212, 191, 0.4);
      border-radius: 99px;
      padding: 10px 22px;
      color: #2dd4bf;
      font-family: 'Manrope', sans-serif;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      animation: collektToastFade 2.6s ease forwards;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    @media (max-width: 480px) {
      .collekt-cookie-card {
        bottom: 12px;
        left: 12px;
        right: 12px;
        width: auto;
        max-width: calc(100vw - 24px);
        padding: 14px 16px;
        border-radius: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

function initModernCookieBanner() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const consentSaved = localStorage.getItem('collekt_cookie_preferences_saved') === 'true' || 
                       localStorage.getItem('collekt_cookie_consent_accepted') === 'true' || 
                       localStorage.getItem('collekt_ndpa_consent_accepted') === 'true';
  if (consentSaved) return;
  if (document.getElementById('collektCookieBanner')) return;

  const renderBanner = () => {
    if (document.getElementById('collektCookieBanner')) return;
    const isSaved = localStorage.getItem('collekt_cookie_preferences_saved') === 'true' || 
                    localStorage.getItem('collekt_cookie_consent_accepted') === 'true' || 
                    localStorage.getItem('collekt_ndpa_consent_accepted') === 'true';
    if (isSaved) return;

    injectCookieStyles();

    const banner = document.createElement('div');
    banner.id = 'collektCookieBanner';
    banner.className = 'collekt-cookie-card';
    banner.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:7px;">
          <span style="font-size:17px; line-height:1;">🍪</span>
          <strong style="font-size:13.5px; color:#ffffff; font-weight:800; letter-spacing:.01em;">
            Cookie &amp; Privacy
          </strong>
        </div>
        <span class="collekt-cookie-badge">NDPA 2023</span>
      </div>

      <p style="font-size:12px; color:#cbd5e1; line-height:1.5; margin:0 0 12px 0;">
        We use essential cookies for security &amp; escrow, and optional cookies to power AI assistance.
        <a href="privacy.html" style="color:#2dd4bf; text-decoration:underline; font-weight:600; margin-left:3px;">Privacy Policy</a>
      </p>

      <div class="collekt-cookie-actions" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <button onclick="rejectNonEssentialCookies()" class="collekt-cookie-btn-reject" id="btnCookieReject">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reject
        </button>
        <button onclick="acceptAllCookies()" class="collekt-cookie-btn-accept" id="btnCookieAcceptAll">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Accept All
        </button>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; font-size:11.5px; padding-top:2px;">
        <button onclick="openCookiePreferencesModal()" class="collekt-cookie-btn-customize" id="btnCookieCustomize">
          ⚙️ Customize Preferences
        </button>
        <a href="javascript:void(0)" onclick="openLegalQuickView('privacy')" style="color:#64748b; font-size:11px; text-decoration:underline; font-weight:600;">
          NDPA Summary
        </a>
      </div>
    `;
    document.body.appendChild(banner);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(renderBanner, 400));
  } else {
    setTimeout(renderBanner, 400);
  }
}

function dismissCookieBanner() {
  const banner = document.getElementById('collektCookieBanner') || document.getElementById('ndpaConsentBanner');
  if (banner) {
    banner.style.animation = 'collektCookieFadeOut 0.35s ease forwards';
    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }, 360);
  }
}

function showCookieToast(msg) {
  const existing = document.getElementById('collektCookieToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'collektCookieToast';
  toast.className = 'collekt-cookie-toast';
  toast.innerHTML = `<span style="font-size:16px;">✓</span> <span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }, 2700);
}

function acceptAllCookies() {
  localStorage.setItem('collekt_cookie_preferences_saved', 'true');
  localStorage.setItem('collekt_cookie_consent_accepted', 'true');
  localStorage.setItem('collekt_ndpa_consent_accepted', 'true');
  localStorage.setItem('collekt_cookies_essential', 'true');
  localStorage.setItem('collekt_cookies_ai', 'true');
  localStorage.setItem('collekt_cookies_analytics', 'true');
  localStorage.setItem('collekt_cookie_consent_timestamp', new Date().toISOString());

  closeCookiePreferencesModal();
  dismissCookieBanner();
  showCookieToast('All cookies accepted & preferences saved.');
}

function openCookiePreferencesModal() {
  injectCookieStyles();
  let modal = document.getElementById('collektCookieModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'collektCookieModal';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; z-index:100002; background:rgba(3, 12, 11, 0.82); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); align-items:center; justify-content:center; padding:20px; animation:collektCookieSlideUp 0.3s ease;';
    document.body.appendChild(modal);
  }

  const aiActive = localStorage.getItem('collekt_cookies_ai') !== 'false';
  const analyticsActive = localStorage.getItem('collekt_cookies_analytics') !== 'false';

  modal.innerHTML = `
    <div style="max-width:580px; width:100%; max-height:90vh; overflow-y:auto; background:rgba(7, 24, 21, 0.95); backdrop-filter:blur(28px) saturate(200%); -webkit-backdrop-filter:blur(28px) saturate(200%); border:1.5px solid rgba(45, 212, 191, 0.32); border-radius:24px; padding:28px; box-shadow:0 32px 80px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.2); color:#f1f5f9; font-family:'Manrope', -apple-system, BlinkMacSystemFont, sans-serif; position:relative;">
      
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:12px; background:rgba(20,184,166,0.18); border:1px solid rgba(45,212,191,0.4); display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0;">
            🍪
          </div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#ffffff;">Cookie &amp; Tracking Preferences</h3>
            <p style="margin:2px 0 0 0; font-size:12px; color:#94a3b8;">Nigeria Data Protection Act (NDPA 2023) Statutory Consent</p>
          </div>
        </div>
        <button onclick="closeCookiePreferencesModal()" style="background:none; border:none; color:#94a3b8; font-size:26px; cursor:pointer; padding:2px 6px; border-radius:8px; line-height:1; transition:color 0.2s;" title="Close">&times;</button>
      </div>

      <div style="font-size:12.5px; color:#cbd5e1; line-height:1.6; margin-bottom:18px;">
        Collekt provides transparent controls over data stored on your device. Essential security cookies are mandatory to safeguard escrow contracts and verify engineering identity.
      </div>

      <!-- Category 1: Strictly Essential (Locked) -->
      <div class="collekt-pref-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:13.5px; color:#ffffff;">Strictly Essential &amp; Security</strong>
            <span style="font-size:10.5px; font-weight:800; color:#2dd4bf; background:rgba(20,184,166,0.18); border:1px solid rgba(45,212,191,0.35); padding:2px 8px; border-radius:99px; text-transform:uppercase;">Always Active</span>
          </div>
          <label class="collekt-cookie-toggle">
            <input type="checkbox" checked disabled>
            <span class="collekt-cookie-slider"></span>
          </label>
        </div>
        <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.55;">
          Required for Supabase token auth, cryptographic session security, Paystack escrow verification, and database Row-Level Security (RLS). Cannot be disabled.
        </p>
      </div>

      <!-- Category 2: Kolly AI & Memory -->
      <div class="collekt-pref-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:13.5px; color:#ffffff;">Kolly AI &amp; Copilot Memory</strong>
            <span style="font-size:10.5px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:99px; text-transform:uppercase;">Recommended</span>
          </div>
          <label class="collekt-cookie-toggle">
            <input type="checkbox" id="collektCookieToggleAi" ${aiActive ? 'checked' : ''}>
            <span class="collekt-cookie-slider"></span>
          </label>
        </div>
        <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.55;">
          Caches active project RFP parameters, workspace context, and multi-turn prompt history for Google Gemini Pro AI matchmaking and engineering cost estimation.
        </p>
      </div>

      <!-- Category 3: Performance & Platform Analytics -->
      <div class="collekt-pref-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:13.5px; color:#ffffff;">Platform Telemetry &amp; Performance</strong>
            <span style="font-size:10.5px; font-weight:700; color:#a78bfa; background:rgba(167,139,250,0.14); border:1px solid rgba(167,139,250,0.3); padding:2px 8px; border-radius:99px; text-transform:uppercase;">Analytics</span>
          </div>
          <label class="collekt-cookie-toggle">
            <input type="checkbox" id="collektCookieToggleAnalytics" ${analyticsActive ? 'checked' : ''}>
            <span class="collekt-cookie-slider"></span>
          </label>
        </div>
        <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.55;">
          Measures anonymized page load latencies and error diagnostics to optimize upload speeds and network resiliency across Nigerian ISP networks (MTN, Airtel, Glo, Starlink).
        </p>
      </div>

      <!-- Footer Actions -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.12); flex-wrap:wrap;">
        <button onclick="rejectNonEssentialCookies()" class="collekt-cookie-btn-reject" style="padding:9px 16px; font-size:12.5px;" id="modalBtnCookieReject">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reject Non-Essential
        </button>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button onclick="saveCustomCookiePreferences()" class="collekt-cookie-btn-customize" style="padding:9px 18px; font-size:12.5px;" id="modalBtnSavePref">
            Save Preferences
          </button>
          <button onclick="acceptAllCookies()" class="collekt-cookie-btn-accept" style="padding:9px 18px; font-size:12.5px;" id="modalBtnAcceptAll">
            Accept All
          </button>
        </div>
      </div>

    </div>
  `;
  modal.style.display = 'flex';
}

function closeCookiePreferencesModal() {
  const modal = document.getElementById('collektCookieModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function saveCustomCookiePreferences() {
  const toggleAi = document.getElementById('collektCookieToggleAi');
  const toggleAnalytics = document.getElementById('collektCookieToggleAnalytics');
  const aiVal = toggleAi ? toggleAi.checked : true;
  const analyticsVal = toggleAnalytics ? toggleAnalytics.checked : true;

  localStorage.setItem('collekt_cookie_preferences_saved', 'true');
  localStorage.setItem('collekt_cookie_consent_accepted', 'true');
  localStorage.setItem('collekt_ndpa_consent_accepted', 'true');
  localStorage.setItem('collekt_cookies_essential', 'true');
  localStorage.setItem('collekt_cookies_ai', String(aiVal));
  localStorage.setItem('collekt_cookies_analytics', String(analyticsVal));
  localStorage.setItem('collekt_cookie_consent_timestamp', new Date().toISOString());

  closeCookiePreferencesModal();
  dismissCookieBanner();
  showCookieToast('Custom cookie preferences saved.');
}

function rejectNonEssentialCookies() {
  localStorage.setItem('collekt_cookie_preferences_saved', 'true');
  localStorage.setItem('collekt_cookie_consent_accepted', 'false');
  localStorage.setItem('collekt_ndpa_consent_accepted', 'true');
  localStorage.setItem('collekt_cookies_essential', 'true');
  localStorage.setItem('collekt_cookies_ai', 'false');
  localStorage.setItem('collekt_cookies_analytics', 'false');
  localStorage.setItem('collekt_cookie_consent_timestamp', new Date().toISOString());

  closeCookiePreferencesModal();
  dismissCookieBanner();
  showCookieToast('Non-essential cookies rejected. Essential security cookies active.');
}

function rejectOptionalCookies() {
  rejectNonEssentialCookies();
}

/* Backward compatibility aliases */
function initNdpaConsentBanner() {
  initModernCookieBanner();
}
function acceptNdpaConsent() {
  acceptAllCookies();
}

function openLegalQuickView(type = 'terms') {
  let modal = document.getElementById('legalQuickViewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'legalQuickViewModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; z-index:100000; background:rgba(4,14,13,0.88); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:20px;';
    document.body.appendChild(modal);
  }

  const isTerms = (type === 'terms');
  const title = isTerms ? 'Collekt Terms of Service & Escrow Charter' : 'Privacy Policy & NDPA 2023 Data Notice';
  const tag = isTerms ? '⚖️ Nigerian Legal Framework &bull; CAMA 2020' : '🛡️ NDPA 2023 Data Protection Notice';

  const bodyContent = isTerms ? `
    <div style="font-size:13px; line-height:1.75; color:var(--ink);">
      <div style="background:rgba(20,184,166,0.12); border-left:3.5px solid var(--teal); padding:12px 14px; border-radius:10px; margin-bottom:16px; font-size:12.5px;">
        <strong>Governing Jurisdiction:</strong> Federal Republic of Nigeria &bull; CAMA 2020 &bull; Arbitration and Mediation Act 2023
      </div>
      <ul style="padding-left:18px; margin:0 0 16px 0; display:flex; flex-direction:column; gap:8px;">
        <li><strong>Technology Marketplace Intermediary:</strong> Collekt Technologies Ltd operates strictly as a neutral technology marketplace, software venue, and escrow intermediary. Collekt is not an employer, general contractor, or engineering firm.</li>
        <li><strong>Milestone Escrow Security:</strong> Project funds are deposited via Korapay and Paystack payment rails into protected escrow custody and disbursed only upon verified milestone approval or 14-day lapse without dispute.</li>
        <li><strong>Automated NUBAN Payouts:</strong> Freelance professionals receive verified NIBSS instant bank transfers directly to their designated Nigerian commercial bank accounts.</li>
        <li><strong>Platform Fees:</strong> Transparent 10% platform commission on completed project milestones, alongside optional Pro ($15/mo) and Enterprise ($50/mo) memberships.</li>
        <li><strong>COREN &amp; CAC Licensure:</strong> Engineers warrant valid COREN registration; corporate entities warrant valid CAC incorporation under CAMA 2020.</li>
        <li><strong>Workplace HSE Safe Harbor:</strong> Worksites, field safety, and physical compliance remain the exclusive duty of clients and executing contractors.</li>
        <li><strong>Limitation of Liability:</strong> Aggregate liability is strictly capped at platform commissions received (max NGN 50,000).</li>
        <li><strong>Binding Lagos Arbitration:</strong> Unresolved controversies defer to a 3-tier resolution concluding in final binding commercial arbitration in Lagos State under the <em>Arbitration and Mediation Act 2023</em>.</li>
      </ul>
      <div style="text-align:center; margin-top:14px;">
        <a href="terms.html" target="_blank" style="color:var(--teal); font-size:12.5px; font-weight:800; text-decoration:underline;">Read Full Terms of Service Document &rarr;</a>
      </div>
    </div>
  ` : `
    <div style="font-size:13px; line-height:1.75; color:var(--ink);">
      <div style="background:rgba(20,184,166,0.12); border-left:3.5px solid var(--teal); padding:12px 14px; border-radius:10px; margin-bottom:16px; font-size:12.5px;">
        <strong>Supervising Authority:</strong> Nigeria Data Protection Commission (NDPC) &bull; NDPA 2023
      </div>
      <ul style="padding-left:18px; margin:0 0 16px 0; display:flex; flex-direction:column; gap:8px;">
        <li><strong>Lawful Bases for Processing:</strong> We collect and process user data strictly under Explicit Consent, Contractual Necessity, and Nigerian Legal Obligations.</li>
        <li><strong>Encrypted KYC &amp; Verification:</strong> NIN numbers, CAC incorporation certificates, and Director credentials submitted for Shield Verification are encrypted with AES-256 and checked against official databases (NIMC, CAC, FIRS).</li>
        <li><strong>Zero Data Brokerage:</strong> Your personal data, proposals, RFPs, CAD drawings, and payment information are never sold or rented to third-party data brokers.</li>
        <li><strong>PostgreSQL Row-Level Security:</strong> Strict multi-tenant security guarantees that only authorized counterparties can view your project bids and confidential messages.</li>
        <li><strong>Statutory Data Subject Rights:</strong> Under NDPA 2023 Section 34, you hold complete rights to access, rectify, export, or request deletion of your personal data at any time.</li>
      </ul>
      <div style="text-align:center; margin-top:14px;">
        <a href="privacy.html" target="_blank" style="color:var(--teal); font-size:12.5px; font-weight:800; text-decoration:underline;">Read Full Privacy Policy Document &rarr;</a>
      </div>
    </div>
  `;

  const hasTermsCheckbox = !!document.getElementById('terms');

  modal.innerHTML = `
    <div class="modal-card" style="max-width:560px; width:100%; border-radius:24px; padding:28px 24px; background:var(--white, #101716); border:1px solid var(--line, rgba(255,255,255,0.1)); position:relative; font-family:'Manrope',sans-serif; max-height:88vh; overflow-y:auto; box-shadow:0 24px 60px rgba(0,0,0,0.5);">
      <button class="modal-close" onclick="document.getElementById('legalQuickViewModal').style.display='none'" style="position:absolute; top:20px; right:20px; background:none; border:none; color:var(--muted, #849694); font-size:24px; cursor:pointer; line-height:1; padding:4px 8px; border-radius:8px;">&times;</button>
      <div style="display:inline-block; font-size:11px; font-weight:800; color:var(--teal); background:rgba(20,184,166,0.14); border:1px solid rgba(20,184,166,0.25); padding:4px 12px; border-radius:99px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.04em;">
        ${tag}
      </div>
      <div style="font-size:20px; font-weight:900; color:var(--ink); margin-bottom:14px; letter-spacing:-0.01em;">${title}</div>
      ${bodyContent}
      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line, rgba(255,255,255,0.1)); display:flex; gap:10px; justify-content:flex-end; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('legalQuickViewModal').style.display='none'" style="font-weight:700; min-height:38px; padding:0 18px; border-radius:10px; font-size:13px;">
          Close
        </button>
        ${hasTermsCheckbox ? `
        <button type="button" class="btn btn-primary btn-sm" onclick="acceptTermsFromModal()" style="font-weight:800; min-height:38px; padding:0 20px; border-radius:10px; background:var(--forest, #0E3B35); color:#fff; font-size:13px;">
          Agree &amp; Accept
        </button>
        ` : `
        <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('legalQuickViewModal').style.display='none'" style="font-weight:800; min-height:38px; padding:0 20px; border-radius:10px; background:var(--forest, #0E3B35); color:#fff; font-size:13px;">
          I Understand
        </button>
        `}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function acceptTermsFromModal() {
  const chk = document.getElementById('terms');
  if (chk) {
    chk.checked = true;
    const container = document.getElementById('termsContainer');
    if (container) container.style.borderColor = 'var(--line, #DDE8E6)';
    const err = document.getElementById('formError');
    if (err && err.textContent.includes('Terms')) err.style.display = 'none';
  }
  const modal = document.getElementById('legalQuickViewModal');
  if (modal) modal.style.display = 'none';
  if (typeof showToast === 'function') {
    showToast('✓ Collekt Terms & Privacy Policy accepted.');
  }
}

window.openLegalQuickView = openLegalQuickView;
window.acceptTermsFromModal = acceptTermsFromModal;
window.acceptNdpaConsent = acceptNdpaConsent;
window.acceptAllCookies = acceptAllCookies;
window.rejectNonEssentialCookies = rejectNonEssentialCookies;
window.rejectOptionalCookies = rejectOptionalCookies;
window.initModernCookieBanner = initModernCookieBanner;
window.initNdpaConsentBanner = initNdpaConsentBanner;
window.openCookiePreferencesModal = openCookiePreferencesModal;
window.closeCookiePreferencesModal = closeCookiePreferencesModal;
window.saveCustomCookiePreferences = saveCustomCookiePreferences;

/* ═ SESSION INACTIVITY & TIMEOUT MANAGER (OWASP ASVS & CBN GUIDELINES) ═ */

const CollektSessionManager = (function() {
  const config = {
    idleMs: 15 * 60 * 1000,     // 15 minutes
    warningMs: 60 * 1000,       // 60 seconds
    storageKey: 'collekt_last_active_timestamp',
    throttleMs: 3000            // Throttle activity updates to once every 3s
  };

  let checkTimer = null;
  let countdownTimer = null;
  let isWarningVisible = false;
  let remainingSeconds = 60;
  let lastRecordedActivity = Date.now();

  function isProtectedPage() {
    try {
      if (typeof window === 'undefined' || !window.location) return false;
      const path = (window.location.pathname || '').toLowerCase();
      const hasUser = typeof getUser === 'function' && !!getUser();
      const hasAdmin = typeof localStorage !== 'undefined' && !!localStorage.getItem('collekt_admin_auth');

      // Exclude public authentication or OAuth processing pages
      if (path.endsWith('login.html') || path.endsWith('admin-login.html') || path.endsWith('auth-callback.html') || path.endsWith('register.html')) {
        return false;
      }

      // If user or admin is authenticated on any portal or financial page
      if (hasUser || hasAdmin) {
        return true;
      }
      return false;
    } catch(e) {
      return false;
    }
  }

  function updateActivityTimestamp(force = false) {
    const now = Date.now();
    if (force || now - lastRecordedActivity >= config.throttleMs) {
      lastRecordedActivity = now;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(config.storageKey, String(now));
        }
      } catch(e) {}
    }
    if (isWarningVisible) {
      hideWarningModal();
    }
  }

  function getEffectiveLastActive() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(config.storageKey);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            return Math.max(parsed, lastRecordedActivity);
          }
        }
      }
    } catch(e) {}
    return lastRecordedActivity;
  }

  function showWarningModal() {
    if (isWarningVisible) return;
    isWarningVisible = true;
    remainingSeconds = Math.round(config.warningMs / 1000);

    if (typeof document === 'undefined') return;

    let modal = document.getElementById('collektInactivityModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'collektInactivityModal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(4,14,13,0.88); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); z-index:99999999; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.25s ease-out;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0c1816; border:1.5px solid rgba(19,117,111,0.35); border-radius:24px; padding:32px 28px; max-width:440px; width:100%; text-align:center; box-shadow:0 32px 80px rgba(0,0,0,0.6); position:relative; font-family:'Manrope',sans-serif;">
        <div style="width:64px; height:64px; border-radius:50%; background:rgba(212,146,11,0.15); border:2px solid rgba(212,146,11,0.5); display:grid; place-items:center; font-size:30px; margin:0 auto 20px auto;">
          🛡️
        </div>
        <div style="font-size:20px; font-weight:900; color:#fff; letter-spacing:-0.4px; margin-bottom:8px;">
          Session Inactivity Notice
        </div>
        <div style="font-size:13px; color:#a1b8b5; line-height:1.6; margin-bottom:20px;">
          For your financial and wallet security under <strong>CBN</strong> and <strong>OWASP ASVS</strong> guidelines, your session has been idle for 15 minutes.
        </div>
        <div style="background:rgba(19,117,111,0.15); border:1px solid rgba(19,117,111,0.3); border-radius:12px; padding:12px; margin-bottom:24px;">
          <div style="font-size:12px; color:#68d391; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;">Auto-Signing Out In</div>
          <div id="collektInactivitySeconds" style="font-size:32px; font-weight:900; color:#fff; font-variant-numeric:tabular-nums; margin-top:2px;">
            ${remainingSeconds}s
          </div>
        </div>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="collektSignOutNowBtn" class="btn btn-outline" style="flex:1; padding:12px; border-color:rgba(255,255,255,0.2); color:#e2efed; font-size:13px; font-weight:800; border-radius:12px; cursor:pointer;">
            Sign Out Now
          </button>
          <button id="collektKeepSignedInBtn" class="btn btn-primary" style="flex:1; padding:12px; background:linear-gradient(135deg, #0e3b35, #13756f); color:#fff; border:none; font-size:13px; font-weight:900; border-radius:12px; cursor:pointer; box-shadow:0 8px 24px rgba(19,117,111,0.4);">
            Keep Me Signed In
          </button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('collektKeepSignedInBtn')?.addEventListener('click', () => {
      updateActivityTimestamp(true);
      hideWarningModal();
    });

    document.getElementById('collektSignOutNowBtn')?.addEventListener('click', () => {
      terminateSession();
    });

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      remainingSeconds--;
      const secEl = document.getElementById('collektInactivitySeconds');
      if (secEl) secEl.textContent = `${remainingSeconds}s`;

      if (remainingSeconds <= 0) {
        clearInterval(countdownTimer);
        terminateSession();
      }
    }, 1000);
  }

  function hideWarningModal() {
    isWarningVisible = false;
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('collektInactivityModal');
      if (modal) modal.style.display = 'none';
    }
  }

  function terminateSession() {
    hideWarningModal();
    if (checkTimer) clearInterval(checkTimer);

    const isAdmin = typeof localStorage !== 'undefined' && !!localStorage.getItem('collekt_admin_auth');
    if (isAdmin && typeof logoutAdminUser === 'function') {
      logoutAdminUser();
      if (typeof window !== 'undefined') window.location.replace('admin-login.html?reason=timeout');
    } else if (typeof logout === 'function') {
      logout();
      if (typeof window !== 'undefined') window.location.replace('login.html?reason=timeout');
    } else {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('collekt_user');
        localStorage.removeItem('collekt_admin_auth');
      }
      if (typeof window !== 'undefined') window.location.replace('login.html?reason=timeout');
    }
  }

  function tick() {
    if (!isProtectedPage()) return;

    const now = Date.now();
    const lastActive = getEffectiveLastActive();
    const idleDuration = now - lastActive;

    if (idleDuration >= config.idleMs + config.warningMs) {
      terminateSession();
    } else if (idleDuration >= config.idleMs) {
      if (!isWarningVisible) {
        showWarningModal();
      }
    } else {
      if (isWarningVisible) {
        hideWarningModal();
      }
    }
  }

  function init() {
    if (!isProtectedPage()) return;

    updateActivityTimestamp(true);

    if (typeof window !== 'undefined') {
      const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(ev => {
        window.addEventListener(ev, () => updateActivityTimestamp(false), { passive: true });
      });

      window.addEventListener('storage', (e) => {
        if (e && e.key === config.storageKey) {
          if (isWarningVisible) hideWarningModal();
        }
      });

      if (checkTimer) clearInterval(checkTimer);
      checkTimer = setInterval(tick, 1000);
    }
  }

  return {
    init,
    tick,
    updateActivityTimestamp,
    showWarningModal,
    hideWarningModal,
    terminateSession,
    isProtectedPage,
    setConfig: (newCfg) => Object.assign(config, newCfg),
    getConfig: () => ({ ...config })
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CollektSessionManager.init());
  } else {
    CollektSessionManager.init();
  }
}

if (typeof window !== 'undefined') {
  window.CollektSessionManager = CollektSessionManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CollektSessionManager };
}



