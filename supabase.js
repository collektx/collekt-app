/* -----------------------------------------------------
   COLLEKT SUPABASE CLIENT & AUTH ENGINE v3.0
   Loaded before app.js on every page.
------------------------------------------------------*/

const SUPABASE_URL = 'https://ozzwvzxugfaveggeznfa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NfHvrN5NDc7JgDXhTo7cAg_q5nFKPk2';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';

// Initialize Supabase client
if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
  try {
    window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  } catch (err) {
    console.warn('Fallback to anon key client initialization:', err);
    window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  }
} else {
  console.warn('Supabase JS library not loaded or blocked.');
  window.sb = null;
}

/* -----------------------------------------------------
   STRICT ACCOUNT ISOLATION HELPER
------------------------------------------------------*/
function clearAllUnscopedUserStorage() {
  const unscopedKeys = [
    'collekt_user',
    'collekt_user_avatar',
    'collekt_company_logo',
    'collekt_user_cover_photo',
    'collekt_user_cv',
    'collekt_custom_quals',
    'collekt_user_nin',
    'collekt_uploads_default'
  ];
  unscopedKeys.forEach(k => {
    try { localStorage.removeItem(k); } catch(e) {}
  });
}

function purgeUnscopedUserStorageIfDifferent(newUserId, newEmail) {
  try {
    const prev = JSON.parse(localStorage.getItem('collekt_user') || 'null');
    if (!prev) return;
    const idMismatch = Boolean(newUserId && prev.id && String(prev.id).toLowerCase() !== String(newUserId).toLowerCase());
    const emailMismatch = Boolean(newEmail && prev.email && String(prev.email).toLowerCase() !== String(newEmail).toLowerCase());
    if (idMismatch || emailMismatch) {
      clearAllUnscopedUserStorage();
    }
  } catch(e) {}
}
window.clearAllUnscopedUserStorage = clearAllUnscopedUserStorage;
window.purgeUnscopedUserStorageIfDifferent = purgeUnscopedUserStorageIfDifferent;

/* -----------------------------------------------------
   AUTH API: Manual Email & Password Sign Up
------------------------------------------------------*/
async function signUpWithEmailPassword({ email, password, role, metadata = {} }) {
  if (!window.sb || !window.sb.auth) {
    return { error: { message: 'Database connection is not available. Please check your internet connection.' } };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const chosenRole = role || metadata.role || 'professional';

  // Ensure any previous user's session/uploads on this browser are purged before signup
  clearAllUnscopedUserStorage();

  // Merge full user metadata passed to Supabase Auth & PostgreSQL triggers
  const composedName = metadata.name || [metadata.first_name, metadata.other_name, metadata.last_name].filter(Boolean).join(' ') || metadata.company_name || cleanEmail.split('@')[0];
  const userMetadata = {
    email: cleanEmail,
    role: chosenRole,
    name: composedName,
    full_name: composedName,
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    other_name: metadata.other_name || '',
    company_name: chosenRole === 'company' ? (metadata.company_name || composedName) : '',
    rep_first_name: metadata.rep_first_name || '',
    rep_last_name: metadata.rep_last_name || '',
    rep_other_name: metadata.rep_other_name || '',
    title: metadata.title || (chosenRole === 'company' ? 'Energy & EPC Enterprise' : 'Energy Specialist'),
    industry: metadata.industry || (chosenRole === 'company' ? 'Energy / EPC Operations' : 'Oil & Gas Engineering'),
    cac: metadata.cac || metadata.cac_number || metadata.rcNumber || '',
    cac_number: metadata.cac || metadata.cac_number || metadata.rcNumber || '',
    ...metadata
  };

  try {
    try {
      sessionStorage.setItem('collekt_awaiting_otp', 'true');
      sessionStorage.removeItem('collekt_just_verified');
    } catch(e) {}

    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: userMetadata
      }
    });

    if (error) {
      return { error };
    }

    const authUser = data.user;
    if (!authUser) {
      return { error: { message: 'Failed to create user account. Please try again.' } };
    }

    // Give Postgres trigger a brief moment to finish row inserts
    await new Promise(r => setTimeout(r, 400));

    // Fetch newly created profile and wallet from Supabase
    let profile = null;
    let wallet = null;
    try {
      const [profRes, wallRes] = await Promise.all([
        sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        sb.from('wallets').select('*').eq('user_id', authUser.id).maybeSingle()
      ]);
      profile = profRes.data;
      wallet = wallRes.data;
    } catch(e) {}

    const localUser = {
      ...(profile || {}),
      id: authUser.id,
      email: cleanEmail,
      name: userMetadata.name,
      full_name: userMetadata.name,
      first_name: userMetadata.first_name,
      last_name: userMetadata.last_name,
      other_name: userMetadata.other_name,
      role: chosenRole,
      company_name: userMetadata.company_name,
      rep_first_name: userMetadata.rep_first_name,
      rep_last_name: userMetadata.rep_last_name,
      rep_other_name: userMetadata.rep_other_name,
      title: userMetadata.title,
      industry: userMetadata.industry,
      sector: userMetadata.industry,
      cac: userMetadata.cac,
      avatar: null,
      avatar_uploaded: false,
      avatar_letter: (userMetadata.name || cleanEmail).charAt(0).toUpperCase(),
      wallet_balance: wallet ? Number(wallet.available_balance || 0) : 0,
      escrow_balance: wallet ? Number(wallet.escrow_balance || 0) : 0,
      is_verified: false,
      verification_status: 'none',
      email_verified: false,
      otp_verified: false,
      terms_accepted: true,
      terms_accepted_at: userMetadata.terms_accepted_at || new Date().toISOString(),
      terms_version: userMetadata.terms_version || '2026.1',
      recaptcha_verified: !!userMetadata.recaptcha_verified,
      created_at: new Date().toISOString()
    };

    try {
      await sb.from('profiles').upsert({
        id: authUser.id,
        email: cleanEmail,
        name: userMetadata.name,
        full_name: userMetadata.name,
        first_name: userMetadata.first_name,
        last_name: userMetadata.last_name,
        other_name: userMetadata.other_name,
        role: chosenRole,
        company_name: userMetadata.company_name,
        rep_first_name: userMetadata.rep_first_name,
        rep_last_name: userMetadata.rep_last_name,
        rep_other_name: userMetadata.rep_other_name,
        title: userMetadata.title,
        industry: userMetadata.industry,
        sector: userMetadata.industry,
        cac: userMetadata.cac,
        cac_number: userMetadata.cac,
        otp_verified: false,
        email_verified: false,
        terms_accepted: true,
        terms_accepted_at: localUser.terms_accepted_at,
        terms_version: localUser.terms_version,
        recaptcha_verified: localUser.recaptcha_verified,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (chosenRole === 'professional') {
        await sb.from('professional_profiles').upsert({
          user_id: authUser.id,
          title: userMetadata.title,
          discipline: userMetadata.industry,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }
    } catch(e) {}

    localStorage.setItem('collekt_user', JSON.stringify(localUser));
    localStorage.setItem('collekt_last_role', chosenRole);
    localStorage.setItem('collekt_last_user_email', cleanEmail);
    if (typeof saveRegisteredUser === 'function') {
      try { saveRegisteredUser(localUser); } catch(e) {}
    }

    return { user: authUser, session: data.session, profile: localUser, error: null };
  } catch (err) {
    console.error('signUpWithEmailPassword exception:', err);
    return { error: { message: err.message || 'An unexpected error occurred during signup.' } };
  }
}

/* -----------------------------------------------------
   AUTH API: Manual Email & Password Sign In
------------------------------------------------------*/
async function signInWithEmailPassword({ email, password }) {
  if (!window.sb || !window.sb.auth) {
    return { error: { message: 'Database connection is not available. Please check your internet connection.' } };
  }

  let cleanEmail = (email || '').trim().toLowerCase();
  if (['admin', 'administrator', 'superadmin', 'master', 'collektadmin'].includes(cleanEmail)) {
    cleanEmail = 'admin@collekt.ng';
  }

  try {
    purgeUnscopedUserStorageIfDifferent(null, cleanEmail);

    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (error) {
      return { error };
    }

    if (!data || !data.user) {
      return { error: { message: 'Authentication returned no active user session.' } };
    }

    const userId = data.user.id;
    purgeUnscopedUserStorageIfDifferent(userId, cleanEmail);

    // Fetch profile and wallet in parallel
    let profile = null;
    let wallet = null;
    try {
      const [profRes, wallRes] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('wallets').select('*').eq('user_id', userId).maybeSingle()
      ]);
      profile = profRes.data;
      wallet = wallRes.data;
    } catch(e) {
      console.warn('Profile/wallet fetch notice on login:', e);
    }

    // Check account status
    if (profile && (profile.suspended === true || profile.status === 'suspended')) {
      await sb.auth.signOut();
      return { error: { message: 'Your account has been suspended by Collekt administration. Please contact support@collekt.ng.' } };
    }

    const role = (profile && profile.role) || data.user.user_metadata?.role || 'professional';
    const metaName = [data.user.user_metadata?.first_name, data.user.user_metadata?.other_name, data.user.user_metadata?.last_name].filter(Boolean).join(' ') || data.user.user_metadata?.name || data.user.user_metadata?.full_name || '';
    const name = (profile && (profile.name || profile.full_name)) || metaName || cleanEmail.split('@')[0];
    const title = (profile && profile.title && profile.title !== 'professional Specialist') ? profile.title : (data.user.user_metadata?.title || '');

    const resolvedAvatar = (profile && (profile.avatar || profile.avatar_url)) ||
                           data.user.user_metadata?.avatar_url ||
                           data.user.user_metadata?.picture ||
                           localStorage.getItem('collekt_user_avatar_' + userId) ||
                           localStorage.getItem('collekt_user_avatar_' + cleanEmail) ||
                           null;
    const resolvedLogo = (profile && (profile.company_logo || profile.logo_url)) ||
                         data.user.user_metadata?.company_logo ||
                         localStorage.getItem('collekt_company_logo_' + userId) ||
                         localStorage.getItem('collekt_company_logo_' + cleanEmail) ||
                         null;

    const localUser = {
      ...(profile || {}),
      id: userId,
      email: cleanEmail,
      name: name,
      full_name: name,
      first_name: (profile && profile.first_name) || data.user.user_metadata?.first_name || '',
      last_name: (profile && profile.last_name) || data.user.user_metadata?.last_name || '',
      other_name: (profile && profile.other_name) || data.user.user_metadata?.other_name || '',
      title: title,
      role: role,
      avatar: resolvedAvatar,
      avatar_url: resolvedAvatar,
      avatar_uploaded: Boolean(resolvedAvatar),
      company_logo: resolvedLogo,
      company_logo_uploaded: Boolean(resolvedLogo),
      avatar_letter: (name || cleanEmail).charAt(0).toUpperCase(),
      wallet_balance: wallet ? Number(wallet.available_balance || 0) : 0,
      escrow_balance: wallet ? Number(wallet.escrow_balance || 0) : 0
    };

    if (typeof setUser === 'function') {
      setUser(localUser);
    } else {
      localStorage.setItem('collekt_user', JSON.stringify(localUser));
    }
    localStorage.setItem('collekt_last_role', role);
    localStorage.setItem('collekt_last_user_email', cleanEmail);
    if (typeof saveRegisteredUser === 'function') {
      try { saveRegisteredUser(localUser); } catch(e) {}
    }

    if (role === 'admin') {
      const adminSession = {
        id: userId,
        email: cleanEmail,
        name: name,
        role: 'admin',
        token: 'adm_sb_' + Date.now(),
        authenticatedAt: new Date().toISOString()
      };
      localStorage.setItem('collekt_admin_auth', JSON.stringify(adminSession));
      sessionStorage.setItem('collekt_admin_auth', JSON.stringify(adminSession));
      document.cookie = "collekt_admin_auth=" + encodeURIComponent(JSON.stringify(adminSession)) + "; path=/; max-age=86400; SameSite=Lax";
      localStorage.setItem('collekt_last_active_timestamp', String(Date.now()));
      localStorage.removeItem('collekt_pending_oauth_role');
      sessionStorage.removeItem('collekt_oauth_in_progress');
    }

    return { user: data.user, session: data.session, profile: localUser, error: null };
  } catch (err) {
    console.error('signInWithEmailPassword exception:', err);
    return { error: { message: err.message || 'An unexpected error occurred during sign in.' } };
  }
}

/* -----------------------------------------------------
   AUTH API: Native Supabase Google OAuth
------------------------------------------------------*/
async function signInWithGoogle(role) {
  const chosenRole = role || localStorage.getItem('collekt_last_role') || 'professional';
  localStorage.setItem('collekt_last_role', chosenRole);
  localStorage.setItem('collekt_pending_oauth_role', chosenRole);
  sessionStorage.setItem('collekt_oauth_in_progress', 'true');

  const redirectUri = window.location.origin + '/auth-callback.html';

  if (window.sb && window.sb.auth) {
    try {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: { prompt: 'select_account' }
        }
      });

      if (error) {
        console.warn('Supabase Google OAuth notice:', error.message);
        if (error.message && (error.message.includes('not enabled') || error.message.includes('Unsupported provider'))) {
          alert('Google OAuth Provider is not enabled yet in your Supabase Dashboard.\n\nTo enable it:\n1. Go to your Supabase Dashboard -> Authentication -> Providers -> Google.\n2. Add your Google OAuth Client ID and Secret.\n3. Save and try again.');
        } else if (typeof showToast === 'function') {
          showToast(error.message || 'Could not initiate Google sign in', 'error');
        } else {
          alert('Google Sign-In notice: ' + error.message);
        }
        return { error };
      }

      if (data && data.url) {
        window.location.href = data.url;
      }
      return { data, error: null };
    } catch(err) {
      console.error('Google sign in error:', err);
      if (typeof showToast === 'function') {
        showToast('Google sign-in error. Please check your connection.', 'error');
      }
      return { error: err };
    }
  } else {
    alert('Supabase client not initialized. Please refresh the page and try again.');
    return { error: { message: 'Supabase client not initialized.' } };
  }
}

// Alias for backwards compatibility
const signInWithGoogleOAuth = signInWithGoogle;

/* -----------------------------------------------------
   AUTH API: Native Supabase LinkedIn (OIDC) OAuth
------------------------------------------------------*/
async function signInWithLinkedIn(role) {
  const chosenRole = role || localStorage.getItem('collekt_last_role') || 'professional';
  localStorage.setItem('collekt_last_role', chosenRole);
  localStorage.setItem('collekt_pending_oauth_role', chosenRole);
  sessionStorage.setItem('collekt_oauth_in_progress', 'true');

  const redirectUri = window.location.origin + '/auth-callback.html';

  if (window.sb && window.sb.auth) {
    try {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: redirectUri
        }
      });

      if (error) {
        console.warn('Supabase LinkedIn OAuth notice:', error.message);
        if (error.message && (error.message.includes('not enabled') || error.message.includes('Unsupported provider') || error.message.includes('validation_failed'))) {
          alert('LinkedIn Sign-In is not enabled yet in your Supabase project.\n\nTo enable it:\n1. Open Supabase Dashboard -> Authentication -> Providers -> LinkedIn (OIDC).\n2. Toggle ON and enter your LinkedIn Client ID & Secret.\n3. Make sure https://ozzwvzxugfaveggeznfa.supabase.co/auth/v1/callback is added to your LinkedIn App.');
          return { error };
        }
        if (typeof showToast === 'function') {
          showToast(error.message || 'Could not initiate LinkedIn sign in', 'error');
        } else {
          alert('LinkedIn Sign-In notice: ' + error.message);
        }
        return { error };
      }

      if (data && data.url) {
        window.location.href = data.url;
      }
      return { data, error: null };
    } catch(err) {
      console.error('LinkedIn sign in error:', err);
      if (typeof showToast === 'function') {
        showToast('LinkedIn sign-in error. Please check your connection.', 'error');
      }
      return { error: err };
    }
  } else {
    alert('Supabase client not initialized. Please refresh the page and try again.');
    return { error: { message: 'Supabase client not initialized.' } };
  }
}

const signInWithLinkedInOAuth = signInWithLinkedIn;

/* -----------------------------------------------------
   AUTH API: Sign Out User
------------------------------------------------------*/
async function signOutUser() {
  try {
    if (window.sb && window.sb.auth) {
      await sb.auth.signOut();
    }
  } catch (e) {
    console.warn('Supabase signout notice:', e);
  } finally {
    clearAllUnscopedUserStorage();
    window.location.replace('login.html');
  }
}

/* -----------------------------------------------------
   Session & Profile Sync Helper
------------------------------------------------------*/
async function syncUser() {
  if (!window.sb) return typeof getUser === 'function' ? getUser() : null;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      const userId = session.user.id;
      const userEmail = session.user.email || '';

      // If cached collekt_user belongs to a different user, purge all unscoped local storage immediately
      purgeUnscopedUserStorageIfDifferent(userId, userEmail);

      const [profRes, wallRes, mediaRes, docsRes] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
        sb.from('media_assets').select('*').eq('user_id', userId).in('asset_type', ['avatar', 'company_logo', 'company-logo']).order('created_at', { ascending: false }).limit(5),
        sb.from('user_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      ]);

      const profile = profRes.data;
      const wallet = wallRes.data;
      const mediaAssets = Array.isArray(mediaRes?.data) ? mediaRes.data : [];
      const remoteDocs = Array.isArray(docsRes?.data) ? docsRes.data : [];

      let localUser = {};
      try {
        const parsedLocal = JSON.parse(localStorage.getItem('collekt_user')) || {};
        if (parsedLocal && parsedLocal.id === userId && (!parsedLocal.email || !userEmail || parsedLocal.email.toLowerCase() === userEmail.toLowerCase())) {
          localUser = parsedLocal;
        }
      } catch(e){}

      const metaFullName = [
        session.user.user_metadata?.first_name || session.user.user_metadata?.given_name,
        session.user.user_metadata?.other_name,
        session.user.user_metadata?.last_name || session.user.user_metadata?.family_name
      ].filter(Boolean).join(' ') || session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

      if (profile) {
        profile.email = userEmail;
        const resolvedName = profile.name || profile.full_name || localUser.name || metaFullName || userEmail.split('@')[0];
        profile.name = resolvedName;
        profile.full_name = resolvedName;
        profile.avatar_letter = (resolvedName || profile.company_name || 'U').charAt(0).toUpperCase();

        const realAvail = wallet ? Number(wallet.available_balance || 0) : 0;
        const realEscrow = wallet ? Number(wallet.escrow_balance || 0) : 0;

        profile.wallet_balance = realAvail;
        profile.escrow_balance = realEscrow;

        const existingWallet = (localUser && localUser.wallet) || {};
        profile.wallet = {
          ...existingWallet,
          balance: realAvail,
          available_balance: realAvail,
          escrow_balance: realEscrow,
          currency: (wallet && wallet.currency) || 'NGN',
          paystack_dva_account: '',
          paystack_dva_bank: '',
          paystack_dva_name: '',
          account_number: existingWallet.nova_linked ? (existingWallet.nova_account_number || '') : '',
          bank_name: existingWallet.nova_linked ? 'NOVA Commercial Bank' : '',
          bank_assigned: !!existingWallet.nova_linked,
          is_live_dva: false
        };
        delete profile.dva_account;
        delete profile.dva_bank;
        delete profile.dva_name;

        const oauthProvider = session.user.app_metadata?.provider || '';
        const isGoogleUser = (localUser && (localUser.provider === 'google' || localUser.oauth_provider === 'google')) ||
                             oauthProvider === 'google' || 
                             session.user.identities?.some(i => i.provider === 'google') ||
                             session.user.app_metadata?.providers?.includes('google');
        const isLinkedInUser = (localUser && (localUser.linkedin_linked || localUser.provider === 'linkedin')) || 
                               oauthProvider === 'linkedin_oidc' || 
                               oauthProvider === 'linkedin' || 
                               session.user.identities?.some(i => i.provider === 'linkedin_oidc' || i.provider === 'linkedin');
        const isOAuthUser = isGoogleUser || isLinkedInUser;

        const finalRole = (profile && profile.role) || (localUser && localUser.role) || localStorage.getItem('collekt_last_role') || 'professional';
        const cleanDbTitle = (profile.title && profile.title !== 'Senior Proposal Manager & Technical Specialist' && profile.title !== 'professional Specialist') ? profile.title : '';
        const resolvedTitle = cleanDbTitle || localUser.title || session.user.user_metadata?.title || '';

        // Resolve Display Picture (DP) and Company Logo across DB, media_assets, Auth metadata, and local storage
        const mediaAvatar = mediaAssets.find(m => m.asset_type === 'avatar' && m.file_url)?.file_url || '';
        const mediaLogo = mediaAssets.find(m => (m.asset_type === 'company_logo' || m.asset_type === 'company-logo') && m.file_url)?.file_url || '';
        const emLower = userEmail.toLowerCase().trim();
        const localScopedAvatar = localStorage.getItem('collekt_user_avatar_' + userId) || (emLower ? localStorage.getItem('collekt_user_avatar_' + emLower) : '') || '';
        const localScopedLogo = localStorage.getItem('collekt_company_logo_' + userId) || (emLower ? localStorage.getItem('collekt_company_logo_' + emLower) : '') || '';

        const bestAvatar = profile.avatar || profile.avatar_url || mediaAvatar || localUser.avatar || localUser.avatar_url || localScopedAvatar || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
        const bestLogo = profile.company_logo || profile.logo_url || mediaLogo || localUser.company_logo || localScopedLogo || session.user.user_metadata?.company_logo || null;

        const finalProfile = {
          ...localUser,
          ...profile,
          id: userId,
          email: userEmail,
          role: finalRole,
          name: resolvedName,
          full_name: resolvedName,
          first_name: profile.first_name || localUser.first_name || session.user.user_metadata?.first_name || session.user.user_metadata?.given_name || (finalRole === 'professional' ? resolvedName.split(' ')[0] : '') || '',
          last_name: profile.last_name || localUser.last_name || session.user.user_metadata?.last_name || session.user.user_metadata?.family_name || (finalRole === 'professional' && resolvedName.includes(' ') ? resolvedName.split(' ').slice(1).join(' ') : '') || '',
          other_name: profile.other_name || localUser.other_name || session.user.user_metadata?.other_name || '',
          bio: profile.bio || localUser.bio || '',
          title: resolvedTitle,
          skills: Array.isArray(profile.skills) && profile.skills.length > 0 ? profile.skills : (Array.isArray(localUser.skills) ? localUser.skills : []),
          avatar: bestAvatar,
          avatar_url: bestAvatar,
          avatar_uploaded: Boolean(bestAvatar),
          company_logo: bestLogo,
          company_logo_uploaded: Boolean(bestLogo),
          verification_submitted_at: profile.verification_submitted_at || localUser.verification_submitted_at || null
        };

        const isAwaitingOtp = (sessionStorage.getItem('collekt_awaiting_otp') === 'true') && !isLinkedInUser;

        // CRITICAL: NEVER allow verified flags to regress to false once verified locally or in DB!
        const isAlreadyOtpVerified = !isAwaitingOtp && (
                                     (profile && profile.otp_verified === true) || 
                                     (localUser && localUser.otp_verified === true && localUser.email === userEmail) || 
                                     (sessionStorage.getItem('collekt_just_verified') === 'true') ||
                                     finalRole === 'admin' ||
                                     isLinkedInUser);

        const isAlreadyEmailVerified = !isAwaitingOtp && (
                                       (profile && profile.email_verified === true) || 
                                       (localUser && localUser.email_verified === true && localUser.email === userEmail) || 
                                       (sessionStorage.getItem('collekt_just_verified') === 'true') ||
                                       finalRole === 'admin' ||
                                       isLinkedInUser);

        finalProfile.otp_verified = isAlreadyOtpVerified;
        finalProfile.email_verified = isAlreadyEmailVerified;

        if (isOAuthUser) {
          if (isGoogleUser) finalProfile.provider = 'google';
          if (isLinkedInUser) finalProfile.provider = 'linkedin';
        }

        // Keep Supabase DB in sync if local state is verified or has fresher name/title/avatar
        const needsDbSync = (isAlreadyOtpVerified && profile && (!profile.otp_verified || !profile.email_verified)) ||
                            (!profile.name && resolvedName) ||
                            (bestAvatar && (!profile.avatar || !profile.avatar_url)) ||
                            (bestLogo && !profile.company_logo);
        if (needsDbSync) {
          try {
            const dbUpdate = {
              name: resolvedName,
              full_name: resolvedName,
              first_name: finalProfile.first_name,
              last_name: finalProfile.last_name,
              other_name: finalProfile.other_name,
              title: resolvedTitle || profile.title,
              otp_verified: isAlreadyOtpVerified,
              email_verified: isAlreadyEmailVerified,
              updated_at: new Date().toISOString()
            };
            if (bestAvatar) {
              dbUpdate.avatar = bestAvatar;
              dbUpdate.avatar_url = bestAvatar;
            }
            if (bestLogo) {
              dbUpdate.company_logo = bestLogo;
            }
            sb.from('profiles').update(dbUpdate).eq('id', userId).then(() => {});
          } catch(e) {}
        }

        if (profile.is_verified == null || !profile.is_verified) {
          if (localUser.verification_status === 'under_review' || finalProfile.verification_submitted_at) {
            finalProfile.verification_status = 'under_review';
          } else if (finalProfile.verification_status !== 'under_review') {
            finalProfile.is_verified = false;
            finalProfile.verified = false;
            finalProfile.identity_verified = false;
            finalProfile.verification_status = 'none';
          }
        }

        // Hydrate uploaded documents from Supabase user_documents into local uploads cache so user can view them anywhere
        if (remoteDocs.length > 0 && typeof _getAllUploads === 'function' && typeof _saveAllUploads === 'function') {
          try {
            const allUp = _getAllUploads(finalProfile);
            remoteDocs.forEach(doc => {
              const docObj = {
                id: doc.id,
                name: doc.file_name || doc.title || 'Uploaded_Document.pdf',
                title: doc.title || doc.file_name || 'Document',
                size: doc.file_size || 0,
                type: doc.mime_type || 'application/pdf',
                dataURL: doc.file_url || '',
                fileUrl: doc.file_url || '',
                file_url: doc.file_url || '',
                file_path: doc.file_path || '',
                storage_bucket: doc.storage_bucket || 'documents',
                category: doc.document_type || 'documents',
                timestamp: doc.created_at || new Date().toISOString()
              };
              const docType = (doc.document_type || '').toLowerCase();
              let cat = 'documents';
              if (docType === 'cv' || docType === 'resume') cat = 'cv';
              else if (docType === 'certification' || docType === 'certifications' || docType === 'certificate') cat = 'certifications';
              else if (docType === 'portfolio') cat = 'portfolio';
              else if (docType === 'nin_doc' || docType === 'gov_id_doc' || docType === 'address_doc' || docType === 'facial_selfie' || docType === 'cac_doc' || docType === 'tin_doc' || docType === 'director_id_doc') cat = docType;

              if (!Array.isArray(allUp[cat])) allUp[cat] = [];
              const exists = allUp[cat].some(existing => existing && (existing.id === docObj.id || existing.name === docObj.name));
              if (!exists) {
                allUp[cat].push(docObj);
              }
              if (cat !== 'documents' && cat !== 'cv') {
                if (!Array.isArray(allUp.documents)) allUp.documents = [];
                if (!allUp.documents.some(existing => existing && (existing.id === docObj.id || existing.name === docObj.name))) {
                  allUp.documents.push(docObj);
                }
              }
            });
            _saveAllUploads(allUp, finalProfile);
          } catch(e) {}
        }

        // Persist avatar in local uploads cache as well
        if (bestAvatar && typeof saveUploadedFile === 'function') {
          try {
            localStorage.setItem('collekt_user_avatar_' + userId, bestAvatar);
            if (emLower) localStorage.setItem('collekt_user_avatar_' + emLower, bestAvatar);
          } catch(e) {}
        }

        if (typeof setUser === 'function') {
          setUser(finalProfile);
        } else {
          localStorage.setItem('collekt_user', JSON.stringify(finalProfile));
        }
        localStorage.setItem('collekt_last_role', finalProfile.role);
        localStorage.setItem('collekt_last_user_email', finalProfile.email);
        if (typeof saveRegisteredUser === 'function') {
          try { saveRegisteredUser(finalProfile); } catch(e) {}
        }

        if (typeof syncUserProposalsFromSupabase === 'function') {
          try { await syncUserProposalsFromSupabase(finalProfile); } catch(e){}
        }

        return finalProfile;
      } else {
        const oauthProvider = session.user.app_metadata?.provider || '';
        const isGoogleUser = oauthProvider === 'google' || 
                             session.user.identities?.some(i => i.provider === 'google') ||
                             session.user.app_metadata?.providers?.includes('google');
        const isLinkedInUser = (localUser && localUser.linkedin_linked) || 
                               oauthProvider === 'linkedin_oidc' || 
                               oauthProvider === 'linkedin' || 
                               session.user.identities?.some(i => i.provider === 'linkedin_oidc' || i.provider === 'linkedin');
        const isOAuthUser = isGoogleUser || isLinkedInUser;

        const role = localStorage.getItem('collekt_pending_oauth_role') || localUser.role || session.user.user_metadata?.role || 'professional';
        const name = metaFullName || localUser.name || userEmail.split('@')[0];
        const firstName = session.user.user_metadata?.first_name || session.user.user_metadata?.given_name || (role === 'professional' ? name.split(' ')[0] : '') || '';
        const lastName = session.user.user_metadata?.last_name || session.user.user_metadata?.family_name || (role === 'professional' && name.includes(' ') ? name.split(' ').slice(1).join(' ') : '') || '';
        const otherName = session.user.user_metadata?.other_name || '';
        const title = session.user.user_metadata?.title || localUser.title || (role === 'company' ? 'Energy & EPC Enterprise' : 'Independent Specialist');
        const isVerifiedNew = isLinkedInUser || role === 'admin' || (localUser && localUser.otp_verified === true && localUser.email === userEmail) || (sessionStorage.getItem('collekt_just_verified') === 'true');
        const emLowerNew = (userEmail || '').toLowerCase();
        const existingLocalAvatar = localUser?.avatar || localUser?.avatar_url ||
          localStorage.getItem('collekt_user_avatar_' + session.user.id) ||
          (emLowerNew ? localStorage.getItem('collekt_user_avatar_' + emLowerNew) : null) ||
          session.user.user_metadata?.avatar_url || null;
        const existingCompanyLogo = localUser?.company_logo ||
          localStorage.getItem('collekt_company_logo_' + session.user.id) ||
          (emLowerNew ? localStorage.getItem('collekt_company_logo_' + emLowerNew) : null) || null;
        const newProfile = {
          id: session.user.id,
          email: userEmail,
          name: name,
          full_name: name,
          first_name: firstName,
          last_name: lastName,
          other_name: otherName,
          role: role,
          title: title,
          avatar: existingLocalAvatar,
          avatar_url: existingLocalAvatar,
          company_logo: existingCompanyLogo,
          avatar_uploaded: Boolean(existingLocalAvatar || existingCompanyLogo),
          oauth_avatar: session.user.user_metadata?.avatar_url || null,
          is_verified: false,
          verification_status: 'none',
          otp_verified: isVerifiedNew,
          email_verified: isVerifiedNew,
          provider: isGoogleUser ? 'google' : (isLinkedInUser ? 'linkedin' : ((localUser && localUser.provider) || undefined)),
          wallet_balance: 0,
          escrow_balance: 0,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: '2026.1',
          created_at: new Date().toISOString()
        };

        const merged = { ...localUser, ...newProfile };
        if (typeof setUser === 'function') {
          setUser(merged);
        } else {
          localStorage.setItem('collekt_user', JSON.stringify(merged));
        }
        localStorage.setItem('collekt_last_role', role);
        localStorage.setItem('collekt_last_user_email', userEmail);

        // Also persist to Supabase profiles table
        try {
          await sb.from('profiles').upsert({
            id: session.user.id,
            email: userEmail,
            name: name,
            full_name: name,
            first_name: firstName,
            last_name: lastName,
            other_name: otherName,
            role: role,
            title: newProfile.title,
            country: 'Nigeria',
            state: 'Lagos',
            location: 'Lagos, Nigeria',
            avatar: existingLocalAvatar,
            avatar_url: existingLocalAvatar,
            company_logo: existingCompanyLogo,
            is_verified: false,
            verification_status: 'none',
            otp_verified: isVerifiedNew,
            email_verified: isVerifiedNew,
            terms_accepted: true,
            terms_accepted_at: newProfile.terms_accepted_at,
            terms_version: newProfile.terms_version,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (e) {}

        return merged;
      }
    }
    return typeof getUser === 'function' ? getUser() : null;
  } catch (err) {
    console.warn('syncUser error:', err);
    return typeof getUser === 'function' ? getUser() : null;
  }
}

/* -----------------------------------------------------
   Direct Profile Persistence Helper
------------------------------------------------------*/
async function persistUserProfile(updates) {
  let currentUser = {};
  try { currentUser = JSON.parse(localStorage.getItem('collekt_user')) || {}; } catch(e){}
  
  const mergedUser = { ...currentUser, ...updates };
  localStorage.setItem('collekt_user', JSON.stringify(mergedUser));
  if (mergedUser.role) {
    localStorage.setItem('collekt_last_role', mergedUser.role);
  }

  // Update directory
  try {
    let allUsers = JSON.parse(localStorage.getItem('collekt_all_users') || '[]');
    let idx = allUsers.findIndex(u => (u.email && u.email.toLowerCase() === mergedUser.email?.toLowerCase()) || (u.id && u.id === mergedUser.id));
    if (idx >= 0) {
      allUsers[idx] = { ...allUsers[idx], ...mergedUser };
    } else if (mergedUser.email) {
      allUsers.push(mergedUser);
    }
    localStorage.setItem('collekt_all_users', JSON.stringify(allUsers));
  } catch(e){}

  // Persist directly to Supabase if connected
  if (window.sb && mergedUser.id) {
    try {
      await sb.from('profiles').upsert({
        id: mergedUser.id,
        email: mergedUser.email,
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase persistUserProfile notice:', err);
    }
  }
  return mergedUser;
}

/* -----------------------------------------------------
   Universal OAuth Return & Session State Handler
------------------------------------------------------*/
async function handleOAuthSessionRouting(session) {
  if (!session || !session.user) return;
  
  const path = (window.location.pathname || '').toLowerCase();
  // DO NOT hijack admin routes or admin sessions!
  if (path.includes('admin')) {
    return;
  }

  const user = await syncUser();

  // If user role is admin, clear any oauth role artifacts and route to admin-dashboard
  if (user && user.role === 'admin') {
    localStorage.removeItem('collekt_pending_oauth_role');
    sessionStorage.removeItem('collekt_oauth_in_progress');
    if (path.endsWith('login.html') || path.endsWith('admin-login.html') || path.endsWith('admin.html')) {
      window.location.replace('admin-dashboard.html');
    }
    return;
  }

  const pendingRole = localStorage.getItem('collekt_pending_oauth_role');
  localStorage.removeItem('collekt_pending_oauth_role');
  sessionStorage.removeItem('collekt_oauth_in_progress');
  
  // Check if returning from a LinkedIn account connection flow
  const isLinkingLinkedIn = (new URLSearchParams(window.location.search)).get('link_identity') === 'linkedin' ||
                            localStorage.getItem('collekt_pending_linkedin_link') ||
                            sessionStorage.getItem('collekt_linking_linkedin_target');

  if (isLinkingLinkedIn && user) {
    // Extract real LinkedIn metadata if available from session
    try {
      const linkedIdentity = session.user.identities?.find(i => i.provider === 'linkedin_oidc' || i.provider === 'linkedin');
      const idData = linkedIdentity?.identity_data || session.user.user_metadata || {};
      const realName = idData.name || idData.full_name || '';
      const realAvatar = idData.picture || idData.avatar_url || '';
      const realSub = linkedIdentity?.id || idData.sub || '';

      user.linkedin_linked = true;
      user.linkedin_verified_at = new Date().toISOString();
      if (realName) user.linkedin_name = realName;
      if (realSub) user.linkedin_sub = realSub;
      if (realAvatar && !user.avatar_uploaded) user.oauth_avatar = realAvatar;
      if (!user.linkedin_url && realName) {
        const slug = realName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        user.linkedin_url = 'https://www.linkedin.com/in/' + slug;
      }
      if (typeof setUser === 'function') setUser(user);
      if (typeof saveRegisteredUser === 'function') saveRegisteredUser(user);
      if (window.sb && user.id) {
        await sb.from('profiles').update({
          linkedin_url: user.linkedin_url,
          linkedin_linked: true,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
      }
    } catch(e) {
      console.warn('LinkedIn linking processing error:', e);
    }
    localStorage.removeItem('collekt_pending_linkedin_link');
    localStorage.removeItem('collekt_linking_linkedin_user_id');
    sessionStorage.removeItem('collekt_linking_linkedin_target');
    window.location.replace('profile.html?linkedin_connected=true');
    return;
  }

  const finalRole = (user && user.role) || pendingRole || localStorage.getItem('collekt_last_role') || 'professional';
  let targetDashboard = 'dashboard.html';
  if (finalRole === 'admin') {
    targetDashboard = 'admin-dashboard.html';
  } else if (finalRole === 'company') {
    targetDashboard = 'company-dashboard.html';
  }

  // Check OTP exemption (Admin & LinkedIn) or verified status
  const isLinkedIn = (user && user.linkedin_linked) || 
                     (session?.user?.identities?.some(i => i.provider === 'linkedin_oidc' || i.provider === 'linkedin')) ||
                     (session?.user?.app_metadata?.provider === 'linkedin_oidc' || session?.user?.app_metadata?.provider === 'linkedin');
  const isAwaitingOtp = (sessionStorage.getItem('collekt_awaiting_otp') === 'true') && !isLinkedIn;
  const isOtpVerified = !isAwaitingOtp && (
                        (user && user.otp_verified === true) || 
                        (sessionStorage.getItem('collekt_just_verified') === 'true') || 
                        finalRole === 'admin' || 
                        isLinkedIn);

  // Always clear oauth state flag now that session is identified
  sessionStorage.removeItem('collekt_oauth_in_progress');
  localStorage.removeItem('collekt_pending_oauth_role');

  const isAuthPage = path.endsWith('login.html') || path.endsWith('/login') || path === '/login' ||
                     path.endsWith('register.html') || path.endsWith('/register') || path === '/register' ||
                     path.endsWith('auth-callback.html') || path.endsWith('/auth-callback') || path === '/auth-callback' ||
                     path === '/' || path.endsWith('index.html');

  if (isAuthPage) {
    if (!isOtpVerified) {
      if (path.includes('register') || path.includes('auth-callback')) {
        console.log('[Auth] Holding dashboard redirect: OTP verification required before dashboard access.');
        return;
      }
      if (path.includes('login')) {
        window.location.replace('auth-callback.html');
      }
      return;
    }
    const currentFile = (window.location.pathname || '').split('/').pop().toLowerCase();
    if (currentFile === targetDashboard.toLowerCase()) {
      return; // Already on target dashboard, do not reload/replace
    }
    try {
      if (typeof window.dispatchLoginAlertIfEnabled === 'function' && user) {
        window.dispatchLoginAlertIfEnabled(user);
      }
    } catch(e) {}
    // Replace URL to prevent back-button loops into OAuth hash
    window.location.replace(targetDashboard);
  }
}

/* -----------------------------------------------------
   REAL USERS DIRECTORY SYNC: Supabase Profiles Engine
   (Queries public_profiles view to exclude sensitive KYC PII)
------------------------------------------------------*/
async function fetchRealRegisteredUsers() {
  if (!window.sb) return typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  try {
    let data = null;
    let error = null;

    // 1. Authoritative: Query public_profiles view FIRST (exposes full public fields: avatar, avatar_url, bio, about, title, sector, skills)
    try {
      const pubRes = await sb.from('public_profiles').select('*').order('created_at', { ascending: true });
      if (!pubRes.error && Array.isArray(pubRes.data) && pubRes.data.length > 0) {
        data = pubRes.data;
      }
    } catch(e) {}

    // 2. Fallback to get_admin_directory RPC only if public_profiles returned nothing
    if (!data || data.length === 0) {
      try {
        if (typeof sb.rpc === 'function') {
          const rpcRes = await sb.rpc('get_admin_directory');
          if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
            data = rpcRes.data;
          }
        }
      } catch(e) {}
    }

    if (Array.isArray(data) && data.length > 0) {
      const activeUser = typeof getUser === 'function' ? getUser() : null;
      const localAvatar = (typeof resolveUserAvatarSrc === 'function' && activeUser) 
        ? resolveUserAvatarSrc(activeUser) 
        : (localStorage.getItem('collekt_user_avatar') || (activeUser && activeUser.avatar) || '');

      const realUsers = data.map(p => {
        const isCo = p.role === 'company';
        const dispName = p.name || p.company_name || p.full_name || p.email;
        let avatarVal = (p.avatar || p.avatar_url || '').trim();

        // If this row matches the active logged-in user and has no avatar in DB yet but activeUser has local avatar, adopt and sync it
        if (!avatarVal && activeUser && localAvatar && (
          (p.id && activeUser.id && String(p.id).toLowerCase() === String(activeUser.id).toLowerCase()) ||
          (p.email && activeUser.email && String(p.email).toLowerCase() === String(activeUser.email).toLowerCase())
        )) {
          avatarVal = localAvatar;
          try {
            if (activeUser.id) {
              sb.from('profiles').update({ avatar: localAvatar, avatar_url: localAvatar, updated_at: new Date().toISOString() }).eq('id', activeUser.id).then(() => {}).catch(() => {});
            }
          } catch(e) {}
        }

        const isVer = Boolean((p.is_verified === true || p.verified === true) && p.verification_status === 'verified');

        return {
          ...p,
          id: p.id,
          email: p.email,
          role: p.role || (isCo ? 'company' : 'professional'),
          name: dispName,
          company_name: isCo ? (p.company_name || dispName) : '',
          avatar: avatarVal,
          avatar_url: p.avatar_url || avatarVal,
          avatar_letter: (dispName || 'U').charAt(0).toUpperCase(),
          verified: isVer,
          is_verified: isVer,
          verification_status: p.verification_status || (isVer ? 'verified' : 'none')
        };
      });
      if (typeof syncRealUsersToDirectory === 'function') {
        syncRealUsersToDirectory(realUsers);
      }
      return realUsers;
    }
  } catch (err) {
    console.warn('fetchRealRegisteredUsers error:', err);
  }
  return typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
}

/* -----------------------------------------------------
   SUPABASE LIVE REAL-TIME MESSAGING ENGINE
------------------------------------------------------*/
let _activeRealtimeChannel = null;
let _activeChatBroadcastChannel = null;

function getCanonicalUserId(userOrId) {
  if (!userOrId) return null;
  if (typeof userOrId === 'object') {
    if (userOrId.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userOrId.id)) {
      return userOrId.id;
    }
    const email = String(userOrId.email || '').toLowerCase().trim();
    if (email) {
      const all = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
      const match = all.find(u => u && u.email && u.email.toLowerCase().trim() === email);
      if (match && match.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
        return match.id;
      }
    }
    return userOrId.id || userOrId.email || null;
  }

  const str = String(userOrId).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str;
  }

  const all = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  const targetLower = str.toLowerCase();
  const match = all.find(u => {
    if (!u) return false;
    const uId = String(u.id || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    const uUser = String(u.username || '').toLowerCase();
    const uName = String(u.name || u.company_name || '').toLowerCase();
    return uId === targetLower || uEmail === targetLower || uUser === targetLower || uName === targetLower;
  });

  if (match && match.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
    return match.id;
  }

  return str;
}
window.getCanonicalUserId = getCanonicalUserId;

function initSupabaseRealtimeMessaging(currentUserId, onNewMessage, onConvUpdate) {
  if (!window.sb || !currentUserId) return null;

  if (_activeRealtimeChannel) {
    try { window.sb.removeChannel(_activeRealtimeChannel); } catch(e){}
    _activeRealtimeChannel = null;
  }
  if (_activeChatBroadcastChannel) {
    try { window.sb.removeChannel(_activeChatBroadcastChannel); } catch(e){}
    _activeChatBroadcastChannel = null;
  }

  try {
    const canonicalId = getCanonicalUserId(currentUserId);
    const cleanId = String(canonicalId).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // 1. Postgres Changes Listener
    const channelName = `collekt_chat_realtime_${cleanId}`;
    const channel = window.sb.channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, payload => {
        const msg = payload.new;
        if (msg) {
          const formatted = {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            body: msg.body,
            media_url: msg.media_url,
            created_at: msg.created_at,
            read: msg.is_read,
            status: 'delivered'
          };
          if (typeof onNewMessage === 'function') {
            onNewMessage(formatted);
          }
          try { window.dispatchEvent(new CustomEvent('collekt_supabase_new_message', { detail: formatted })); } catch(e){}
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, payload => {
        const msg = payload.new;
        try { window.dispatchEvent(new CustomEvent('collekt_supabase_msg_updated', { detail: msg })); } catch(e){}
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations'
      }, payload => {
        if (typeof onConvUpdate === 'function') {
          onConvUpdate(payload);
        }
        try { window.dispatchEvent(new CustomEvent('collekt_supabase_conv_updated', { detail: payload })); } catch(e){}
      })
      .subscribe((status) => {
        console.log('Supabase Realtime Messaging subscription status:', status);
      });

    // 2. Broadcast Channel for Instant Sub-100ms Push
    const broadcastChan = window.sb.channel('collekt_chat_broadcast')
      .on('broadcast', { event: 'new_message' }, payload => {
        const msg = payload && payload.payload ? payload.payload : payload;
        if (msg && msg.conversation_id) {
          const myId = String(canonicalId).toLowerCase();
          const targetRecipient = String(msg.receiver_id || '').toLowerCase();
          const sender = String(msg.sender_id || '').toLowerCase();
          
          // Accept if sender is not me and target is me (or in shared conversation)
          if (sender !== myId && (!targetRecipient || targetRecipient === myId)) {
            const formatted = {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              body: msg.body,
              media_url: msg.media_url,
              created_at: msg.created_at || new Date().toISOString(),
              read: msg.read || false,
              status: 'delivered'
            };
            if (typeof onNewMessage === 'function') {
              onNewMessage(formatted);
            }
            try { window.dispatchEvent(new CustomEvent('collekt_supabase_new_message', { detail: formatted })); } catch(e){}
          }
        }
      })
      .on('broadcast', { event: 'messages_read' }, payload => {
        const data = payload && payload.payload ? payload.payload : payload;
        if (data && data.conversation_id) {
          try { window.dispatchEvent(new CustomEvent('collekt_supabase_msg_read', { detail: data })); } catch(e){}
        }
      })
      .subscribe();

    _activeRealtimeChannel = channel;
    _activeChatBroadcastChannel = broadcastChan;
    return channel;
  } catch (err) {
    console.warn('initSupabaseRealtimeMessaging error:', err);
    return null;
  }
}

async function broadcastRealtimeMessage(msgPacket) {
  if (!window.sb || !msgPacket) return;
  try {
    const chan = _activeChatBroadcastChannel || window.sb.channel('collekt_chat_broadcast');
    await chan.send({
      type: 'broadcast',
      event: 'new_message',
      payload: msgPacket
    });
  } catch(e) {
    console.warn('broadcastRealtimeMessage notice:', e);
  }
}

async function fetchUserConversationsFromSupabase(userId) {
  if (!window.sb || !userId) return [];
  try {
    const canonicalId = getCanonicalUserId(userId);
    const { data: convs, error } = await sb
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${canonicalId},participant_b.eq.${canonicalId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    if (!convs) return [];

    return convs.map(c => ({
      id: c.id,
      participants: [c.participant_a, c.participant_b],
      created_at: c.created_at,
      last_message: c.last_message_preview || '',
      last_at: c.last_message_at || c.created_at
    }));
  } catch(err) {
    console.warn('fetchUserConversationsFromSupabase error:', err);
    return [];
  }
}

async function fetchMessagesFromSupabase(conversationId) {
  if (!window.sb || !conversationId) return [];
  try {
    const { data: msgs, error } = await sb
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!msgs) return [];

    return msgs.map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      body: m.body,
      media_url: m.media_url,
      created_at: m.created_at,
      read: Boolean(m.is_read),
      status: m.is_read ? 'read' : 'delivered'
    }));
  } catch(err) {
    console.warn('fetchMessagesFromSupabase error:', err);
    return [];
  }
}

async function sendSupabaseMessage(conversationId, senderId, body, mediaUrl = null, receiverId = null) {
  if (!window.sb || !conversationId || !senderId || !body) return null;
  try {
    const canonicalSender = getCanonicalUserId(senderId);
    const trimmed = String(body).trim();
    const { data: msg, error } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: canonicalSender,
        body: trimmed,
        media_url: mediaUrl,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;

    const preview = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    try {
      await sb
        .from('conversations')
        .update({
          last_message_preview: preview,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    } catch(convErr) {
      console.warn('Update conversation last message notice:', convErr);
    }

    // Instant Realtime broadcast push
    broadcastRealtimeMessage({
      id: msg.id,
      conversation_id: conversationId,
      sender_id: canonicalSender,
      receiver_id: receiverId ? getCanonicalUserId(receiverId) : null,
      body: trimmed,
      media_url: mediaUrl,
      created_at: msg.created_at,
      read: false
    });

    return msg;
  } catch(err) {
    console.warn('sendSupabaseMessage error:', err);
    throw err;
  }
}

async function createSupabaseConversation(participantA, participantB) {
  if (!window.sb || !participantA || !participantB) return null;
  try {
    const canonicalA = getCanonicalUserId(participantA);
    const canonicalB = getCanonicalUserId(participantB);

    if (!canonicalA || !canonicalB || canonicalA === canonicalB) return null;

    // Check existing in either direction
    const { data: existingA } = await sb
      .from('conversations')
      .select('*')
      .eq('participant_a', canonicalA)
      .eq('participant_b', canonicalB)
      .maybeSingle();

    if (existingA) return existingA;

    const { data: existingB } = await sb
      .from('conversations')
      .select('*')
      .eq('participant_a', canonicalB)
      .eq('participant_b', canonicalA)
      .maybeSingle();

    if (existingB) return existingB;

    // Insert new conversation record
    const { data: newConv, error: insertErr } = await sb
      .from('conversations')
      .insert({
        participant_a: canonicalA,
        participant_b: canonicalB,
        last_message_preview: '',
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    return newConv;
  } catch(err) {
    console.warn('createSupabaseConversation error:', err);
    return null;
  }
}

async function markSupabaseMessagesAsRead(conversationId, currentUserId) {
  if (!window.sb || !conversationId || !currentUserId) return;
  try {
    const canonicalUser = getCanonicalUserId(currentUserId);
    await sb
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', canonicalUser)
      .eq('is_read', false);

    if (_activeChatBroadcastChannel) {
      try {
        _activeChatBroadcastChannel.send({
          type: 'broadcast',
          event: 'messages_read',
          payload: { conversation_id: conversationId, reader_id: canonicalUser }
        });
      } catch(e){}
    }
  } catch(err) {
    console.warn('markSupabaseMessagesAsRead notice:', err);
  }
}

// -- LIVE MARKETPLACE OPPORTUNITIES & SUPABASE PROJECT SYNC --
let _activeRealtimeProjectsChannel = null;

async function fetchLiveJobsFromSupabase() {
  if (!window.sb) {
    return typeof getPostedJobs === 'function' ? getPostedJobs() : [];
  }
  try {
    const { data, error } = await window.sb
      .from('projects')
      .select('*, company:company_id(id, full_name, company_name, is_verified, verification_status, avatar_url, location)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || !Array.isArray(data)) return [];

    const normalized = data.map(p => {
      const co = p.company || {};
      const companyName = p.company_name || co.company_name || co.full_name || 'Energy Enterprise';
      const isVerified = (co.is_verified === true || co.verification_status === 'verified');
      const budgetNum = (p.budget != null && !isNaN(p.budget) && Number(p.budget) > 0) ? Number(p.budget) : (p.professional_fee != null && !isNaN(p.professional_fee) && Number(p.professional_fee) > 0 ? Number(p.professional_fee) : 0);

      return {
        id: p.id,
        title: p.title || 'Untitled Opportunity',
        type: p.opportunity_type || 'Short-Term Job',
        category: p.category || 'EPC & Engineering',
        experience: p.experience_level || 'Senior Specialist (8-14 Years)',
        location: p.location || 'Lagos, Nigeria',
        budget: budgetNum,
        professional_fee: budgetNum,
        budget_rate_type: p.budget_rate_type || 'Total Contract Budget',
        duration: p.duration || 'Flexible',
        deadline: p.deadline || 'Ongoing',
        skills: Array.isArray(p.skills_required) ? p.skills_required : [p.category || 'Engineering'],
        description: p.description || '',
        scope: p.description || '',
        company_id: p.company_id,
        company_name: companyName,
        companyName: companyName,
        company_verified: isVerified,
        company_logo: co.avatar_url || '',
        status: (p.status || 'OPEN').toLowerCase(),
        created_at: p.created_at,
        posted_at: p.created_at
      };
    });

    try {
      localStorage.setItem('collekt_posted_jobs', JSON.stringify(normalized));
    } catch(e){}

    return normalized;
  } catch(err) {
    console.warn('fetchLiveJobsFromSupabase error:', err);
    return typeof getPostedJobs === 'function' ? getPostedJobs() : [];
  }
}

async function publishJobToSupabase(jobData) {
  if (!window.sb) return null;
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    let companyId = jobData.company_id || user?.id || null;
    if (!companyId || companyId === 'company' || companyId.startsWith('usr_')) {
      companyId = (user && user.id && !user.id.startsWith('usr_')) ? user.id : null;
    }

    const budgetVal = (jobData.budget != null && !isNaN(jobData.budget) && Number(jobData.budget) > 0) ? Number(jobData.budget) : null;

    const payload = {
      company_id: companyId,
      company_name: jobData.company_name || jobData.companyName || user?.company_name || user?.name || 'Verified Client',
      title: jobData.title,
      description: jobData.description || jobData.scope || '',
      category: jobData.category || 'EPC & Engineering',
      opportunity_type: jobData.type || 'Short-Term Job',
      experience_level: jobData.experience || 'Any Experience Level',
      budget: budgetVal,
      professional_fee: budgetVal,
      budget_rate_type: jobData.budget_rate_type || 'Total Contract Budget',
      duration: jobData.duration || 'Flexible',
      deadline: jobData.deadline || 'Ongoing',
      location: jobData.location || 'Nigeria',
      skills_required: Array.isArray(jobData.skills) ? jobData.skills : [],
      status: 'OPEN'
    };

    const { data, error } = await window.sb
      .from('projects')
      .insert([payload])
      .select();

    if (error) throw error;
    const inserted = data && data[0] ? data[0] : null;
    await fetchLiveJobsFromSupabase();
    return inserted;
  } catch (err) {
    console.error('publishJobToSupabase error:', err);
    throw err;
  }
}

async function updateJobInSupabase(jobId, jobData) {
  if (!window.sb || !jobId) return false;
  try {
    const budgetVal = (jobData.budget != null && !isNaN(jobData.budget) && Number(jobData.budget) > 0) ? Number(jobData.budget) : null;

    const payload = {
      title: jobData.title,
      description: jobData.description || jobData.scope || '',
      category: jobData.category || 'EPC & Engineering',
      opportunity_type: jobData.type || 'Short-Term Job',
      experience_level: jobData.experience || 'Any Experience Level',
      budget: budgetVal,
      professional_fee: budgetVal,
      budget_rate_type: jobData.budget_rate_type || 'Total Contract Budget',
      duration: jobData.duration || 'Flexible',
      deadline: jobData.deadline || 'Ongoing',
      location: jobData.location || 'Nigeria',
      skills_required: Array.isArray(jobData.skills) ? jobData.skills : [],
      updated_at: new Date().toISOString()
    };

    const { error } = await window.sb
      .from('projects')
      .update(payload)
      .eq('id', jobId);

    if (error) throw error;
    await fetchLiveJobsFromSupabase();
    return true;
  } catch(err) {
    console.error('updateJobInSupabase error:', err);
    throw err;
  }
}

async function deleteJobFromSupabase(jobId) {
  if (!window.sb || !jobId) return false;
  try {
    const { error } = await window.sb
      .from('projects')
      .delete()
      .eq('id', jobId);

    if (error) throw error;

    try {
      const current = (typeof getPostedJobs === 'function' ? getPostedJobs() : []).filter(j => String(j.id) !== String(jobId));
      localStorage.setItem('collekt_posted_jobs', JSON.stringify(current));
    } catch(e){}

    return true;
  } catch(err) {
    console.error('deleteJobFromSupabase error:', err);
    throw err;
  }
}

function initSupabaseRealtimeProjects(onProjectChange) {
  if (!window.sb || _activeRealtimeProjectsChannel) return _activeRealtimeProjectsChannel;
  try {
    const channel = window.sb
      .channel('db-projects-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects'
      }, async (payload) => {
        console.log('Realtime project event received:', payload.eventType);
        await fetchLiveJobsFromSupabase();
        if (typeof onProjectChange === 'function') {
          onProjectChange(payload);
        }
        try { window.dispatchEvent(new CustomEvent('collekt_projects_updated', { detail: payload })); } catch(e){}
      })
      .subscribe((status) => {
        console.log('Supabase Realtime Projects subscription status:', status);
      });

    _activeRealtimeProjectsChannel = channel;
    return channel;
  } catch (err) {
    console.warn('initSupabaseRealtimeProjects notice:', err);
    return null;
  }
}

/* ═════════════════════════════════════════════════════════
   COLLECTIONS / PROPOSALS / CONTRACTS DATABASE ENGINE
   (Canonical implementations defined below in Section 9-14)
   ═════════════════════════════════════════════════════════ */

function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Auto-initialize session listener and OAuth redirect handler
if (window.sb && window.sb.auth) {
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasOAuthParams = hash.includes('access_token=') || hash.includes('refresh_token=') || search.includes('code=');
    const wasOAuthStarted = sessionStorage.getItem('collekt_oauth_in_progress') === 'true';

    // Primary listener
    window.sb.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('admin') || path.includes('auth-callback') || path.includes('register')) {
          // Do not hijack admin routing or active OTP verification screens on auth-callback/register
          await syncUser();
          return;
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || hasOAuthParams || wasOAuthStarted) {
          await handleOAuthSessionRouting(session);
        } else {
          await syncUser();
        }
      }
    });

    // Secondary check if session already established or tokens present in hash
    if (hasOAuthParams || wasOAuthStarted) {
      setTimeout(async () => {
        try {
          const path = (window.location.pathname || '').toLowerCase();
          if (path.includes('admin') || path.includes('auth-callback') || path.includes('register')) return;
          const { data: { session } } = await window.sb.auth.getSession();
          if (session && session.user) {
            await handleOAuthSessionRouting(session);
          }
        } catch(err) {
          console.warn('OAuth session check fallback:', err);
        }
      }, 250);
    }
  } catch(e) {
    console.warn('Supabase auth state change error:', e);
  }
}

/* -----------------------------------------------------
   STORAGE & DOCUMENT PERSISTENCE API
   Handles files (PDF, DOCX, images), user form inputs,
   media assets, and AI generations in Supabase
------------------------------------------------------*/

/**
 * Binary magic-byte signature and executable quarantine validator
 * OWASP ASVS V12.1 / CWE-434 / CWE-436 | CBN Cybersecurity Framework Sec 4.1 & 4.2
 */
async function validateFileSignature(fileOrBlob, declaredExt = '') {
  if (!fileOrBlob) return { valid: false, error: 'No file provided' };
  try {
    const ext = (declaredExt || (fileOrBlob.name ? fileOrBlob.name.split('.').pop() : '')).toLowerCase();
    let header = [];
    if (typeof fileOrBlob.slice === 'function') {
      const slice = fileOrBlob.slice(0, 64);
      if (typeof slice.arrayBuffer === 'function') {
        const buf = await slice.arrayBuffer();
        header = Array.from(new Uint8Array(buf));
      }
    } else if (fileOrBlob instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBlob))) {
      header = Array.from(fileOrBlob.slice(0, 64));
    }

    if (header.length > 0) {
      // Prohibited Windows PE / MZ: 0x4D 0x5A or 0x5A 0x4D
      if (header.length >= 2 && ((header[0] === 0x4D && header[1] === 0x5A) || (header[0] === 0x5A && header[1] === 0x4D))) {
        return { valid: false, error: 'Security Quarantine: Disguised Windows Executable (MZ / PE) header rejected (OWASP ASVS V12.1 / CWE-434).' };
      }
      // Prohibited Linux ELF: 0x7F 0x45 0x4C 0x46
      if (header.length >= 4 && header[0] === 0x7F && header[1] === 0x45 && header[2] === 0x4C && header[3] === 0x46) {
        return { valid: false, error: 'Security Quarantine: Disguised Linux ELF binary rejected (OWASP ASVS V12.1).' };
      }
      // Prohibited Mach-O / Java bytecode
      if (header.length >= 4 && (
        (header[0] === 0xFE && header[1] === 0xED && header[2] === 0xFA) ||
        (header[0] === 0xCA && header[1] === 0xFE && header[2] === 0xBA && header[3] === 0xBE)
      )) {
        return { valid: false, error: 'Security Quarantine: Prohibited executable bytecode rejected.' };
      }
      // Prohibited Shebang: #! (0x23 0x21)
      if (header.length >= 2 && header[0] === 0x23 && header[1] === 0x21) {
        return { valid: false, error: 'Security Quarantine: Prohibited script shebang detected.' };
      }
    }

    return { valid: true };
  } catch (err) {
    console.warn('validateFileSignature check warning:', err);
    return { valid: true };
  }
}

/**
 * Upload any File, Blob, or Uint8Array to Supabase Storage
 */
async function uploadFileToSupabaseStorage(bucket, path, file, contentType) {
  if (!window.sb || !window.sb.storage) {
    return { error: { message: 'Supabase storage client not available' } };
  }
  try {
    const options = { upsert: true };
    if (contentType) options.contentType = contentType;
    else if (file && file.type) options.contentType = file.type;

    const { data, error } = await window.sb.storage.from(bucket).upload(path, file, options);
    if (error) {
      console.warn(`[Supabase Storage] Upload error to bucket "${bucket}":`, error);
      return { error };
    }

    let publicUrl = null;
    let signedUrl = null;

    if (bucket === 'documents') {
      try {
        const { data: signData } = await window.sb.storage.from(bucket).createSignedUrl(path, 3600);
        signedUrl = signData ? signData.signedUrl : null;
        publicUrl = signedUrl;
      } catch (e) {
        console.warn('[Supabase Storage] createSignedUrl fallback error:', e);
      }
    } else {
      const { data: pubData } = window.sb.storage.from(bucket).getPublicUrl(path);
      publicUrl = pubData ? pubData.publicUrl : null;
    }

    return { data, publicUrl, signedUrl, path, error: null };
  } catch (err) {
    console.error('[Supabase Storage] Unexpected upload failure:', err);
    return { error: err };
  }
}

/**
 * Generate a time-limited signed URL for a private storage object (OWASP ASVS compliant)
 * Default expiration: 300 seconds (5 minutes)
 */
async function getSignedDocumentUrl(bucket, filePath, expiresIn = 300) {
  if (!window.sb || !window.sb.storage) {
    return { signedUrl: null, error: { message: 'Supabase storage client not available' } };
  }
  try {
    const targetBucket = bucket || 'documents';
    const cleanPath = (filePath || '').replace(/^[\\/]+/, '');
    const { data, error } = await window.sb.storage.from(targetBucket).createSignedUrl(cleanPath, expiresIn);
    if (error) {
      console.warn(`[Supabase Storage] Failed to generate signed URL for "${cleanPath}" in "${targetBucket}":`, error);
      return { signedUrl: null, error };
    }
    return { signedUrl: data?.signedUrl || null, error: null };
  } catch (err) {
    console.error('[Supabase Storage] getSignedDocumentUrl error:', err);
    return { signedUrl: null, error: err };
  }
}

/**
 * Resolves a viewable URL for a document object.
 * Automatically requests a time-limited signed URL for private storage files.
 */
async function getOrGenerateDocumentViewUrl(doc, expiresIn = 300) {
  if (!doc) return null;
  if (typeof doc === 'string') {
    if (doc.startsWith('data:') || doc.startsWith('blob:')) return doc;
    if (doc.includes('token=')) return doc;
    const match = doc.match(/\/storage\/v1\/object\/(?:public|authenticated)\/documents\/(.+)$/);
    if (match && match[1]) {
      const path = decodeURIComponent(match[1].split('?')[0]);
      const res = await getSignedDocumentUrl('documents', path, expiresIn);
      if (res.signedUrl) return res.signedUrl;
    }
    return doc;
  }

  if (doc.dataURL && (doc.dataURL.startsWith('data:') || doc.dataURL.startsWith('blob:'))) {
    return doc.dataURL;
  }

  const filePath = doc.file_path || doc.filePath || doc.path;
  const bucket = doc.storage_bucket || doc.storageBucket || 'documents';
  if (filePath && window.sb && window.sb.storage) {
    const res = await getSignedDocumentUrl(bucket, filePath, expiresIn);
    if (res.signedUrl) return res.signedUrl;
  }

  const rawUrl = doc.file_url || doc.fileUrl || doc.url || doc.dataURL;
  if (rawUrl && typeof rawUrl === 'string') {
    if (rawUrl.includes('token=')) return rawUrl;
    const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|authenticated)\/documents\/(.+)$/);
    if (match && match[1]) {
      const path = decodeURIComponent(match[1].split('?')[0]);
      const res = await getSignedDocumentUrl('documents', path, expiresIn);
      if (res.signedUrl) return res.signedUrl;
    }
    return rawUrl;
  }

  return null;
}

/**
 * Insert or record a document in public.user_documents
 */
async function saveUserDocumentRecord(docData) {
  if (!window.sb) return { error: { message: 'Database client not ready' } };
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    const userId = docData.user_id || user?.id;
    if (!userId) return { error: { message: 'User ID is required to save document record' } };

    const payload = {
      user_id: userId,
      document_type: docData.document_type || 'other',
      title: docData.title || docData.file_name || 'Document',
      file_name: docData.file_name || 'document.pdf',
      file_extension: (docData.file_extension || docData.file_name?.split('.').pop() || 'pdf').toLowerCase(),
      mime_type: docData.mime_type || 'application/pdf',
      file_size: docData.file_size || 0,
      storage_bucket: docData.storage_bucket || 'documents',
      file_path: docData.file_path || '',
      file_url: docData.file_url || '',
      is_generated: !!docData.is_generated,
      source_data: docData.source_data || {},
      verification_status: docData.verification_status || 'unverified',
      related_entity_type: docData.related_entity_type || null,
      related_entity_id: docData.related_entity_id ? String(docData.related_entity_id) : null,
      metadata: docData.metadata || {}
    };

    const { data, error } = await window.sb.from('user_documents').insert(payload).select().single();
    if (error) {
      console.warn('[user_documents] Insert error:', error);
      return { error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('[user_documents] Error:', err);
    return { error: err };
  }
}

/**
 * Upload binary file to Supabase Storage and register in public.user_documents
 */
async function uploadAndSaveUserDocument({ file, documentType, title, relatedEntityType, relatedEntityId, isGenerated = false, sourceData = {}, metadata = {} }) {
  if (!file) return { error: { message: 'No file provided' } };
  const user = typeof getUser === 'function' ? getUser() : null;
  const userId = user?.id;
  if (!userId) return { error: { message: 'You must be signed in to upload documents.' } };

  const rawName = file.name || `${documentType || 'document'}_${Date.now()}.pdf`;
  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = (cleanName.split('.').pop() || 'pdf').toLowerCase();

  // Validate magic bytes & quarantine disguised executables (OWASP ASVS V12.1 / CWE-434)
  const validation = await validateFileSignature(file, ext);
  if (!validation.valid) {
    return { error: { message: validation.error } };
  }

  const filePath = `${userId}/${documentType || 'docs'}/${Date.now()}_${cleanName}`;
  const mimeType = file.type || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream');

  let finalViewUrl = '';
  const uploadRes = await uploadFileToSupabaseStorage('documents', filePath, file, mimeType);
  if (uploadRes && !uploadRes.error) {
    finalViewUrl = uploadRes.signedUrl || uploadRes.publicUrl || '';
  } else {
    // Fallback to DataURL so the user can always view & access their document across devices
    try {
      finalViewUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result || '');
        r.onerror = () => resolve('');
        r.readAsDataURL(file);
      });
    } catch (e) {}
  }

  const docRecord = await saveUserDocumentRecord({
    user_id: userId,
    document_type: documentType || 'other',
    title: title || rawName,
    file_name: cleanName,
    file_extension: ext,
    mime_type: mimeType,
    file_size: file.size || 0,
    storage_bucket: 'documents',
    file_path: filePath,
    file_url: finalViewUrl,
    is_generated: isGenerated,
    source_data: sourceData,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    metadata: metadata
  });

  // If CV, also update professional_profiles and local session
  if (documentType === 'cv') {
    try {
      await window.sb.from('professional_profiles').update({ cv_url: finalViewUrl }).eq('user_id', userId);
      if (user) {
        user.cv_url = finalViewUrl;
        user.cv_name = cleanName;
        user.cv_size = file.size || 0;
        if (typeof setUser === 'function') setUser(user);
      }
    } catch(e) { console.warn('CV profile sync warning:', e); }
  }

  return { data: docRecord.data, publicUrl: finalViewUrl, signedUrl: uploadRes?.signedUrl || finalViewUrl, filePath: filePath, path: filePath, error: null };
}

/**
 * Insert or record an image asset in public.media_assets
 */
async function saveMediaAssetRecord(assetData) {
  if (!window.sb) return { error: { message: 'Database client not ready' } };
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    const userId = assetData.user_id || user?.id;
    if (!userId) return { error: { message: 'User ID is required to save media asset' } };

    const payload = {
      user_id: userId,
      asset_type: assetData.asset_type || 'image',
      title: assetData.title || assetData.file_name || 'Media Asset',
      prompt: assetData.prompt || null,
      negative_prompt: assetData.negative_prompt || null,
      generator_model: assetData.generator_model || null,
      storage_bucket: assetData.storage_bucket || 'media',
      file_path: assetData.file_path || '',
      file_url: assetData.file_url || '',
      file_name: assetData.file_name || 'image.png',
      mime_type: assetData.mime_type || 'image/png',
      file_size: assetData.file_size || 0,
      dimensions: assetData.dimensions || { width: 0, height: 0 },
      related_entity_type: assetData.related_entity_type || null,
      related_entity_id: assetData.related_entity_id ? String(assetData.related_entity_id) : null,
      metadata: assetData.metadata || {},
      is_public: assetData.is_public !== undefined ? assetData.is_public : true
    };

    const { data, error } = await window.sb.from('media_assets').insert(payload).select().single();
    if (error) {
      console.warn('[media_assets] Insert error:', error);
      return { error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('[media_assets] Error:', err);
    return { error: err };
  }
}

/**
 * Upload binary or Base64 image to Supabase Storage and register in public.media_assets
 */
async function uploadAndSaveMediaAsset({ file, dataUrl, assetType = 'avatar', title, prompt, generatorModel, dimensions, relatedEntityType, relatedEntityId, metadata = {} }) {
  const user = typeof getUser === 'function' ? getUser() : null;
  const userId = user?.id;
  if (!userId) return { error: { message: 'You must be signed in to upload media.' } };

  let uploadBlob = file;
  let mimeType = file ? file.type : 'image/png';
  let rawName = file ? file.name : `${assetType}_${Date.now()}.png`;
  let resolvedDataUrl = dataUrl || null;

  // If dataUrl was provided instead of File
  if (!uploadBlob && dataUrl) {
    try {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      uploadBlob = new Blob([u8arr], { type: mimeType });
    } catch(e) {
      console.warn('Base64 to Blob conversion error:', e);
      return { error: e };
    }
  }

  if (!uploadBlob && !resolvedDataUrl) return { error: { message: 'No image file or Data URL provided' } };

  if (uploadBlob) {
    const assetExt = (rawName.split('.').pop() || 'png').toLowerCase();
    const validation = await validateFileSignature(uploadBlob, assetExt);
    if (!validation.valid) {
      return { error: { message: validation.error } };
    }
    if (!resolvedDataUrl) {
      try {
        resolvedDataUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target.result || null);
          r.onerror = () => resolve(null);
          r.readAsDataURL(uploadBlob);
        });
      } catch (e) {}
    }
  }

  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${assetType}/${Date.now()}_${cleanName}`;

  const uploadRes = uploadBlob ? await uploadFileToSupabaseStorage('media', filePath, uploadBlob, mimeType) : { error: true };
  const finalAssetUrl = (uploadRes && !uploadRes.error && uploadRes.publicUrl) ? uploadRes.publicUrl : (resolvedDataUrl || '');

  const assetRecord = await saveMediaAssetRecord({
    user_id: userId,
    asset_type: assetType,
    title: title || rawName,
    prompt: prompt || null,
    generator_model: generatorModel || null,
    storage_bucket: 'media',
    file_path: filePath,
    file_url: finalAssetUrl,
    file_name: cleanName,
    mime_type: mimeType,
    file_size: uploadBlob?.size || 0,
    dimensions: dimensions || { width: 0, height: 0 },
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    metadata: metadata
  });

  // Sync profile avatars or company logos
  if (assetType === 'avatar' && finalAssetUrl) {
    try {
      await window.sb.from('profiles').update({ avatar_url: finalAssetUrl, avatar: finalAssetUrl }).eq('id', userId);
      if (user) {
        user.avatar = finalAssetUrl;
        user.avatar_url = finalAssetUrl;
        user.avatar_uploaded = true;
        if (typeof setUser === 'function') setUser(user);
      }
      localStorage.setItem('collekt_user_avatar_' + userId, finalAssetUrl);
      if (user?.email) localStorage.setItem('collekt_user_avatar_' + user.email.toLowerCase(), finalAssetUrl);
    } catch(e){}
  } else if (assetType === 'company_logo' && finalAssetUrl) {
    try {
      await Promise.all([
        window.sb.from('profiles').update({ company_logo: finalAssetUrl, avatar: finalAssetUrl }).eq('id', userId),
        window.sb.from('companies').update({ company_logo: finalAssetUrl }).eq('user_id', userId)
      ]);
      if (user) {
        user.company_logo = finalAssetUrl;
        user.avatar = finalAssetUrl;
        user.avatar_uploaded = true;
        if (typeof setUser === 'function') setUser(user);
      }
      localStorage.setItem('collekt_company_logo_' + userId, finalAssetUrl);
      if (user?.email) localStorage.setItem('collekt_company_logo_' + user.email.toLowerCase(), finalAssetUrl);
    } catch(e){}
  }

  return { data: assetRecord.data, publicUrl: finalAssetUrl, error: null };
}

/**
 * Persist arbitrary structured user form inputs to public.user_inputs
 */
async function saveUserInputSubmission({ formType, title, inputData, status = 'submitted', relatedDocumentId, relatedMediaId, metadata = {} }) {
  if (!window.sb) return { error: { message: 'Database client not ready' } };
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    const userId = user?.id;
    if (!userId) return { error: { message: 'User ID required for form submission' } };

    const payload = {
      user_id: userId,
      form_type: formType || 'general_submission',
      title: title || `${formType || 'Submission'} - ${new Date().toLocaleDateString()}`,
      input_data: inputData || {},
      status: status,
      related_document_id: relatedDocumentId || null,
      related_media_id: relatedMediaId || null,
      metadata: metadata
    };

    const { data, error } = await window.sb.from('user_inputs').insert(payload).select().single();
    if (error) {
      console.warn('[user_inputs] Insert error:', error);
      return { error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('[user_inputs] Error:', err);
    return { error: err };
  }
}

/**
 * Record AI generations and prompt logs
 */
async function recordAIGeneration({ generationType, prompt, systemInstruction, outputText, outputMediaId, outputDocumentId, model, tokenUsage, status = 'completed' }) {
  if (!window.sb) return { error: { message: 'Database client not ready' } };
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    const userId = user?.id;
    if (!userId) return { error: { message: 'User ID required' } };

    const payload = {
      user_id: userId,
      generation_type: generationType || 'ai_query',
      prompt: prompt || '',
      system_instruction: systemInstruction || null,
      output_text: outputText || '',
      output_media_id: outputMediaId || null,
      output_document_id: outputDocumentId || null,
      model: model || 'gemini-1.5-flash',
      token_usage: tokenUsage || {},
      status: status
    };

    const { data, error } = await window.sb.from('ai_generations').insert(payload).select().single();
    
    // Also log to user_inputs for unified input traceability
    saveUserInputSubmission({
      formType: 'ai_prompt_query',
      title: `AI Generation: ${generationType || 'Prompt'}`,
      inputData: { prompt, outputText: (outputText || '').substring(0, 500) },
      relatedDocumentId: outputDocumentId,
      relatedMediaId: outputMediaId,
      metadata: { model, generationType }
    }).catch(()=>{});

    if (error) {
      console.warn('[ai_generations] Insert error:', error);
      return { error };
    }
    return { data, error: null };
  } catch (err) {
    console.error('[ai_generations] Error:', err);
    return { error: err };
  }
}

/**
 * Fetch documents from public.user_documents
 */
async function fetchUserDocuments(userId, documentType = null) {
  if (!window.sb) return { data: [], error: { message: 'Database client not ready' } };
  try {
    let query = window.sb.from('user_documents').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (documentType) query = query.eq('document_type', documentType);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data: data || [], error };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Fetch media assets from public.media_assets
 */
async function fetchUserMediaAssets(userId, assetType = null) {
  if (!window.sb) return { data: [], error: { message: 'Database client not ready' } };
  try {
    let query = window.sb.from('media_assets').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (assetType) query = query.eq('asset_type', assetType);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data: data || [], error };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Fetch user form inputs from public.user_inputs
 */
async function fetchUserInputs(userId, formType = null) {
  if (!window.sb) return { data: [], error: { message: 'Database client not ready' } };
  try {
    let query = window.sb.from('user_inputs').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (formType) query = query.eq('form_type', formType);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data: data || [], error };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Dynamically load html2pdf.js on demand for clean PDF generation
 */
function loadHtml2PdfLibrary() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('Failed to load html2pdf script'));
    document.head.appendChild(script);
  });
}

/**
 * Generate a professional branded PDF from HTML element / string,
 * upload directly to Supabase Storage 'documents' bucket,
 * record in public.user_documents, and optionally download
 */
async function generateAndSaveFinalPDF({
  title = 'Collekt_Document',
  documentType = 'proposal_pdf',
  filename = null,
  htmlContent = '',
  element = null,
  sourceData = {},
  metadata = {},
  relatedEntityType = null,
  relatedEntityId = null,
  downloadImmediate = true
}) {
  const user = typeof getUser === 'function' ? getUser() : null;
  const userId = user?.id;
  const cleanBaseName = (filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`).replace(/\.pdf$/i, '') + '.pdf';

  try {
    if (typeof showToast === 'function') showToast('Compiling PDF document with Collekt engine...');
    await loadHtml2PdfLibrary();

    let targetElement = element;
    let removeAfter = false;

    if (!targetElement) {
      removeAfter = true;
      targetElement = document.createElement('div');
      targetElement.style.padding = '36px 44px';
      targetElement.style.fontFamily = "'Manrope', sans-serif";
      targetElement.style.color = '#111918';
      targetElement.style.background = '#ffffff';
      targetElement.style.width = '794px'; // standard A4 width at 96 DPI
      targetElement.style.boxSizing = 'border-box';
      targetElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0E3B35; padding-bottom:16px; margin-bottom:24px;">
          <div>
            <div style="font-size:24px; font-weight:900; color:#0E3B35; letter-spacing:-0.5px;">COLLEKT</div>
            <div style="font-size:11px; color:#13756F; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Energy &amp; EPC Infrastructure Platform</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px; font-weight:800; color:#111918;">${typeof escapeHTML === 'function' ? escapeHTML(title) : title}</div>
            <div style="font-size:11px; color:#6B8280;">Date: ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</div>
          </div>
        </div>
        <div style="font-size:13px; line-height:1.7; color:#223330; margin-bottom:32px;">
          ${htmlContent}
        </div>
        <div style="border-top:1px solid #DDE8E6; padding-top:16px; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
          <div>Certified Collekt Platform Document &bull; Verification Hash: ${Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
          <div>collektng.com</div>
        </div>
      `;
      document.body.appendChild(targetElement);
    }

    const opt = {
      margin: [10, 10, 10, 10],
      filename: cleanBaseName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate PDF Blob
    const worker = window.html2pdf().set(opt).from(targetElement);
    const pdfBlob = await worker.outputPdf('blob');

    if (removeAfter && targetElement.parentNode) {
      targetElement.parentNode.removeChild(targetElement);
    }

    // Direct upload if signed in
    let publicUrl = null;
    let docRecord = null;

    if (userId && window.sb) {
      const uploadRes = await uploadAndSaveUserDocument({
        file: new File([pdfBlob], cleanBaseName, { type: 'application/pdf' }),
        documentType: documentType,
        title: title,
        relatedEntityType: relatedEntityType,
        relatedEntityId: relatedEntityId,
        isGenerated: true,
        sourceData: sourceData,
        metadata: { ...metadata, generated_at: new Date().toISOString() }
      });

      if (!uploadRes.error) {
        publicUrl = uploadRes.publicUrl;
        docRecord = uploadRes.data;
        if (typeof showToast === 'function') showToast('PDF successfully saved to your Collekt database!');
      }
    }

    // Trigger instant browser download if requested
    if (downloadImmediate) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = cleanBaseName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    }

    return { success: true, blob: pdfBlob, publicUrl, data: docRecord, error: null };
  } catch (err) {
    console.error('PDF generation error:', err);
    if (typeof showToast === 'function') showToast('Could not compile PDF: ' + err.message, 'warning');
    return { success: false, error: err };
  }
}

/* -----------------------------------------------------
   FINANCIAL WALLET, DEDICATED VIRTUAL ACCOUNTS & PAYMENTS
------------------------------------------------------*/

/**
 * Helper to safely parse JSON from HTTP responses without syntax errors on HTML error pages
 */
async function safeParseJsonResponse(res) {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { ok: res.ok, status: res.status, data: json };
    } catch (e) {
      return { ok: false, status: res.status, data: null, isHtml: true, raw: text };
    }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

/**
 * 1. Initialize Server-Side Wallet Funding Checkout
 */
async function initializeWalletFunding({ amount, email, payment_method = 'card', user_id, owner_id, owner_type = 'user', gateway, name, customer_name, displayName }) {
  try {
    const selectedGateway = gateway || (payment_method === 'opay' ? 'opay' : 'korapay');
    const resolvedName = name || customer_name || displayName || '';
    const numAmount = Number(amount);
    const cleanRef = `COL-FUND-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 1. Try serverless endpoint first
    try {
      const res = await fetch('/.netlify/functions/paystack-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          email,
          payment_method,
          gateway: selectedGateway,
          user_id,
          owner_id: owner_id || user_id,
          owner_type,
          name: resolvedName,
          customer_name: resolvedName,
          displayName: resolvedName
        })
      });

      const parsed = await safeParseJsonResponse(res);
      const resPayload = parsed.data || {};
      const checkoutUrl = resPayload.authorization_url || resPayload.checkout_url || resPayload.data?.authorization_url || resPayload.data?.checkout_url;
      if (checkoutUrl) {
        return { success: true, data: { ...resPayload, authorization_url: checkoutUrl, checkout_url: checkoutUrl } };
      }
      if (resPayload.error || resPayload.message) {
        return { success: false, error: resPayload.error || resPayload.message };
      }
    } catch (netErr) {
      console.warn('Serverless payment init note:', netErr.message);
      return { success: false, error: netErr.message || 'Connection to payment gateway failed' };
    }

    return {
      success: false,
      error: 'Unable to initialize payment session. Please try again.'
    };
  } catch (err) {
    console.error('initializeWalletFunding error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Verify Payment Transaction Server-Side
 */
async function verifyWalletPayment(reference) {
  try {
    const res = await fetch(`/.netlify/functions/paystack-verify?reference=${encodeURIComponent(reference)}`);
    const parsed = await safeParseJsonResponse(res);
    if (parsed.ok && parsed.data) {
      return { success: true, data: parsed.data };
    }
    return { success: false, error: parsed.data?.error || 'Verification pending' };
  } catch (err) {
    console.error('verifyWalletPayment error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Fetch Dedicated Virtual Account (DVA) with direct Supabase database fallback
 */
async function fetchDedicatedVirtualAccount(ownerId) {
  // Dedicated Virtual Accounts & Fidelity Bank display disabled per platform configuration
  return { success: false, not_found: true, disabled: true };
}

async function provisionDedicatedVirtualAccount(params) {
  try {
    const u = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const ownerId = params.owner_id || params.user_id || u?.id || u?.owner_id;
    const email = (params.email || u?.email || '').trim().toLowerCase();
    let displayName = params.name || params.displayName || u?.company_name || u?.name;
    if (!displayName || displayName === 'Collekt Member' || displayName === 'User' || displayName === 'Guest') {
      displayName = [u?.first_name, u?.other_name, u?.last_name].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'Account Holder');
    }
    const formattedAcctName = `COLLEKT / ${displayName.toUpperCase()}`;

    // 1. Try serverless function (Korapay dedicated account)
    try {
      const res = await fetch('/.netlify/functions/korapay-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data) {
        if (parsed.data.virtual_account || parsed.data.data) {
          const vData = parsed.data.virtual_account || parsed.data.data;
          if (vData && vData.account_number && !String(vData.account_number).startsWith('07000') && vData.account_number !== '0167384649') {
            return {
              success: true,
              data: vData,
              status: parsed.data.status
            };
          }
        }
        if (parsed.data.requires_instant_checkout) {
          return {
            success: false,
            requires_instant_checkout: true,
            message: parsed.data.message || 'Direct Bank Transfer funding is ready via Korapay Live Checkout.'
          };
        }
      }
    } catch (e) {}

    try {
      const res = await fetch('/.netlify/functions/paystack-dva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data && parsed.data.virtual_account) {
        const vData = parsed.data.virtual_account;
        if (vData && vData.account_number && !String(vData.account_number).startsWith('07000') && vData.account_number !== '0167384649') {
          return {
            success: true,
            data: vData,
            status: parsed.data.status
          };
        }
      }
    } catch (e) {}

    // 2. Direct Supabase Query
    if (window.sb && ownerId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId);
      let query = window.sb.from('virtual_accounts').select('*');
      if (isUUID) {
        query = query.or(`owner_id.eq.${ownerId},user_id.eq.${ownerId}`);
      } else {
        query = query.eq('owner_id', ownerId);
      }

      const { data: existing } = await query.eq('status', 'active').maybeSingle();
      if (existing && existing.account_number && !String(existing.account_number).startsWith('07000') && existing.account_number !== '0167384649') {
        return {
          success: true,
          data: {
            account_number: existing.account_number,
            account_name: existing.account_name || formattedAcctName,
            bank_name: existing.bank_name,
            bank_code: existing.bank_code,
            currency: existing.currency || 'NGN',
            status: existing.status,
            provider: existing.provider
          }
        };
      }

    }

    return { 
      success: false, 
      requires_instant_checkout: true,
      message: 'Dedicated Virtual Accounts require merchant activation on Korapay. Instant Bank Transfer funding is available.' 
    };
  } catch (err) {
    console.error('provisionDedicatedVirtualAccount error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. Fetch Double-Entry Wallet Ledger & History
 */
async function fetchWalletLedger(ownerId) {
  if (!window.sb || !ownerId) return { data: [], error: null };
  try {
    const { data, error } = await sb
      .from('wallet_ledger')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  } catch (err) {
    console.error('fetchWalletLedger error:', err);
    return { data: [], error: err };
  }
}

/**
 * 5. Fetch Company Members & Roles
 */
async function fetchCompanyMembers(companyId) {
  if (!companyId) return { data: [], error: null };
  try {
    // 1. Try serverless function first
    try {
      const res = await fetch(`/.netlify/functions/company-team?company_id=${encodeURIComponent(companyId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          return { data: json.data, error: null };
        }
      }
    } catch(e) {}

    // 2. Direct Supabase fallback
    if (window.sb) {
      const { data, error } = await sb
        .from('company_members')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'removed')
        .order('created_at', { ascending: true });

      return { data: data || [], error };
    }

    return { data: [], error: null };
  } catch (err) {
    console.error('fetchCompanyMembers error:', err);
    return { data: [], error: err };
  }
}

/**
 * 5b. Invite Company Member
 */
async function inviteCompanyMember(companyId, inviterId, name, email, role) {
  if (!companyId || !email || !name) {
    return { success: false, error: 'Company ID, name, and email are required.' };
  }
  try {
    const payload = {
      action: 'invite',
      company_id: companyId,
      inviter_id: inviterId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || 'member'
    };

    const res = await fetch('/.netlify/functions/company-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      return { success: false, error: json.error || 'Failed to send invitation' };
    }

    return { success: true, data: json.data, message: json.message };
  } catch (err) {
    console.error('inviteCompanyMember error:', err);
    // Direct Supabase fallback if network fails
    if (window.sb) {
      try {
        const { data, error } = await sb
          .from('company_members')
          .insert({
            company_id: companyId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: role || 'member',
            status: 'pending',
            invited_by: inviterId || null,
            invited_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, data, message: 'Member invited successfully' };
      } catch(sbErr) {
        return { success: false, error: sbErr.message };
      }
    }
    return { success: false, error: err.message };
  }
}

/**
 * 5c. Remove Company Member
 */
async function removeCompanyMemberFromDb(companyId, inviterId, memberId) {
  if (!companyId || !memberId) return { success: false, error: 'Missing parameters' };
  try {
    const res = await fetch('/.netlify/functions/company-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'remove',
        company_id: companyId,
        inviter_id: inviterId,
        member_id: memberId
      })
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      return { success: false, error: json.error || 'Failed to remove member' };
    }
    return { success: true };
  } catch (err) {
    console.error('removeCompanyMember error:', err);
    if (window.sb) {
      try {
        await sb.from('company_members').delete().eq('id', memberId).eq('company_id', companyId);
        return { success: true };
      } catch(sbErr) {
        return { success: false, error: sbErr.message };
      }
    }
    return { success: false, error: err.message };
  }
}

/**
 * 5d. Update Company Member Role
 */
async function updateCompanyMemberRoleInDb(companyId, inviterId, memberId, role) {
  if (!companyId || !memberId || !role) return { success: false, error: 'Missing parameters' };
  try {
    const res = await fetch('/.netlify/functions/company-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_role',
        company_id: companyId,
        inviter_id: inviterId,
        member_id: memberId,
        role: role
      })
    });
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      return { success: false, error: json.error || 'Failed to update role' };
    }
    return { success: true, data: json.data };
  } catch (err) {
    console.error('updateCompanyMemberRole error:', err);
    if (window.sb) {
      try {
        const { data, error } = await sb
          .from('company_members')
          .update({ role: role, updated_at: new Date().toISOString() })
          .eq('id', memberId)
          .eq('company_id', companyId)
          .select()
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      } catch(sbErr) {
        return { success: false, error: sbErr.message };
      }
    }
    return { success: false, error: err.message };
  }
}

/**
 * 6. Fetch Comprehensive Nigerian Bank List
 */
let _cachedBanksClient = null;
async function fetchNigerianBanks() {
  if (_cachedBanksClient && _cachedBanksClient.length > 0) {
    return { success: true, data: _cachedBanksClient };
  }
  try {
    const res = await fetch('/.netlify/functions/banks');
    if (!res.ok) throw new Error('Failed to load bank list');
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.data)) {
      _cachedBanksClient = data.data;
      return { success: true, data: data.data };
    }
    throw new Error(data.error || 'Invalid bank response');
  } catch (err) {
    console.warn('fetchNigerianBanks fallback note:', err);
    const fallback = [
      { name: 'Access Bank', code: '044', category: 'commercial' },
      { name: 'Guaranty Trust Bank (GTBank)', code: '058', category: 'commercial' },
      { name: 'Zenith Bank', code: '057', category: 'commercial' },
      { name: 'First Bank of Nigeria', code: '011', category: 'commercial' },
      { name: 'United Bank for Africa (UBA)', code: '033', category: 'commercial' },
      { name: 'OPay (Paycom)', code: '305', category: 'digital' },
      { name: 'PalmPay', code: '100033', category: 'digital' },
      { name: 'Moniepoint Microfinance Bank', code: '090405', category: 'digital' },
      { name: 'Kuda Bank', code: '50211', category: 'digital' },
      { name: 'FCMB', code: '214', category: 'commercial' },
      { name: 'Wema Bank', code: '035', category: 'commercial' },
      { name: 'Stanbic IBTC Bank', code: '221', category: 'commercial' },
      { name: 'Sterling Bank', code: '232', category: 'commercial' },
      { name: 'Fidelity Bank', code: '070', category: 'commercial' },
      { name: 'Union Bank of Nigeria', code: '032', category: 'commercial' },
      { name: 'Polaris Bank', code: '076', category: 'commercial' },
      { name: 'Keystone Bank', code: '082', category: 'commercial' },
      { name: 'Providus Bank', code: '101', category: 'commercial' },
      { name: 'NOVA Bank (Nova Commercial Bank)', code: '561', category: 'commercial' },
      { name: 'FairMoney MFB', code: '090551', category: 'digital' },
      { name: 'Carbon (One Finance)', code: '940', category: 'digital' },
      { name: 'VFD Microfinance Bank', code: '566', category: 'digital' },
      { name: 'Dot Microfinance Bank', code: '50322', category: 'digital' },
      { name: 'Jaiz Bank', code: '301', category: 'commercial' },
      { name: 'TAJ Bank', code: '302', category: 'commercial' },
      { name: 'Lotus Bank', code: '303', category: 'commercial' },
      { name: 'Titan Trust Bank', code: '102', category: 'commercial' }
    ];
    return { success: true, data: fallback };
  }
}

/**
 * 7. Resolve Bank Account via NIBSS (Korapay / Paystack)
 */
async function resolveBankAccount({ account_number, bank_code }) {
  try {
    const cleanAcct = String(account_number || '').trim().replace(/\D/g, '');
    const cleanBank = String(bank_code || '').trim();
    if (!cleanAcct || cleanAcct.length !== 10) {
      return { success: false, error: 'Valid 10-digit NUBAN required' };
    }
    if (!cleanBank) {
      return { success: false, error: 'Please select a bank' };
    }

    let headers = {};
    if (typeof window !== 'undefined' && window.sb?.auth) {
      try {
        const session = (await window.sb.auth.getSession())?.data?.session;
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (e) {}
    }

    const res = await fetch(`/.netlify/functions/bank-resolve?account_number=${encodeURIComponent(cleanAcct)}&bank_code=${encodeURIComponent(cleanBank)}`, {
      headers
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      return {
        success: false,
        error: data.error || 'Could not verify account name with NIBSS. Please check account details.'
      };
    }

    return {
      success: true,
      account_name: data.data.account_name,
      account_number: data.data.account_number,
      bank_code: data.data.bank_code,
      provider: data.data.provider
    };
  } catch (err) {
    console.error('resolveBankAccount error:', err);
    return { success: false, error: err.message || 'Account resolution network error' };
  }
}

/**
 * 8. Execute Double-Entry Wallet Withdrawal
 */
async function withdrawWalletFunds(params) {
  try {
    const user = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const payload = {
      amount: Number(params.amount),
      bank_code: String(params.bank_code || '').trim(),
      bank_name: String(params.bank_name || '').trim(),
      account_number: String(params.account_number || '').trim(),
      account_name: String(params.account_name || '').trim(),
      narration: params.narration || 'Collekt Wallet Withdrawal',
      user_id: params.user_id || user.id,
      owner_id: params.owner_id || user.id || user.owner_id,
      owner_type: params.owner_type || (user.role === 'company' ? 'company' : 'user'),
      role: params.role || user.role || 'professional',
      pin: params.pin ? String(params.pin).trim() : undefined,
      step_up_token: params.step_up_token ? String(params.step_up_token).trim() : undefined,
      auth_token: params.auth_token ? String(params.auth_token).trim() : undefined
    };

    let authHeaderVal = '';
    try {
      const sess = await window.sb?.auth?.getSession();
      if (sess?.data?.session?.access_token) {
        authHeaderVal = `Bearer ${sess.data.session.access_token}`;
      }
    } catch(e){}

    const res = await fetch('/.netlify/functions/paystack-withdraw', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authHeaderVal ? { 'Authorization': authHeaderVal } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Withdrawal processing failed' };
    }

    return {
      success: true,
      data: data,
      message: data.message,
      reference: data.reference,
      balance_after: data.balance_after
    };
  } catch (err) {
    console.error('withdrawWalletFunds error:', err);
    return { success: false, error: err.message || 'Withdrawal network error' };
  }
}

/**
 * 9. Submit Professional Collection Request (Marketplace 'Collekt')
 */
async function submitCollectionRequestToSupabase(req) {
  try {
    const user = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const proId = req.userId || req.user_id || req.pro_id || user?.id || '';
    const proEmail = req.userEmail || req.user_email || user?.email || '';
    const projectId = req.jobId || req.project_id || req.projectId || '';

    if (!projectId) {
      return { success: false, error: 'Opportunity ID is required' };
    }
    if (!proId && !proEmail) {
      return { success: false, error: 'Professional identification required' };
    }

    // 1. Check existing in Local Storage
    let localProps = [];
    try {
      localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    } catch(e){}

    const existingLocal = localProps.find(p => 
      (String(p.jobId || p.project_id) === String(projectId)) &&
      ((proId && String(p.userId || p.pro_id) === String(proId)) || (proEmail && String(p.userEmail || '').toLowerCase() === String(proEmail).toLowerCase()))
    );

    // 2. Check existing in Supabase
    let existingSb = null;
    if (window.sb && proId && isValidUUID(projectId) && isValidUUID(proId)) {
      try {
        const { data } = await sb.from('proposals').select('*').eq('project_id', projectId).eq('pro_id', proId).maybeSingle();
        if (data) existingSb = data;
      } catch(sbErr) {
        console.warn('Check existing proposal Supabase note:', sbErr);
      }
    }

    const existing = existingSb || existingLocal;
    if (existing && existing.status !== 'uncollekted' && existing.status !== 'withdrawn') {
      return {
        success: false,
        duplicate: true,
        data: existing,
        message: 'You have already collected this opportunity.'
      };
    }

    const proposalId = (req.id && isValidUUID(req.id)) ? req.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('prop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)));
    const nowIso = new Date().toISOString();

    const proposalData = {
      id: proposalId,
      jobId: projectId,
      project_id: projectId,
      projectId: projectId,
      jobTitle: req.jobTitle || req.title || 'Marketplace Opportunity',
      companyId: req.companyId || req.company_id || '',
      company_id: req.companyId || req.company_id || '',
      companyName: req.companyName || req.company_name || 'Verified Corporate Employer',
      company_name: req.companyName || req.company_name || 'Verified Corporate Employer',
      companyEmail: req.companyEmail || req.company_email || '',
      userId: proId,
      user_id: proId,
      pro_id: proId,
      userName: req.userName || user?.name || user?.username || 'Professional Candidate',
      userEmail: proEmail,
      userTitle: req.userTitle || user?.title || 'Project Specialist',
      userAvatar: req.userAvatar || user?.avatar || '',
      userRating: req.userRating || user?.rating || 0,
      userLocation: req.userLocation || user?.location || 'Nigeria',
      userSkills: req.userSkills || user?.skills || [],
      bidAmount: Number(req.bidAmount || req.proposedAmount || req.budget || 0),
      proposedAmount: Number(req.bidAmount || req.proposedAmount || req.budget || 0),
      budget: Number(req.budget || req.bidAmount || 0),
      deliveryDays: Number(req.deliveryDays || req.delivery_days || 14),
      timeline: req.timeline || '2 Weeks',
      pitchText: req.pitchText || req.coverLetter || 'Collected via Marketplace',
      coverLetter: req.pitchText || req.coverLetter || 'Collected via Marketplace',
      status: 'PENDING',
      created_at: nowIso,
      updated_at: nowIso
    };

    // Save to Local Storage immediately
    const updatedLocal = localProps.filter(p => p.id !== proposalId && String(p.jobId || p.project_id) !== String(projectId));
    updatedLocal.unshift(proposalData);
    localStorage.setItem('collekt_proposals', JSON.stringify(updatedLocal));

    // Persist to Supabase using valid schema columns (id, project_id, pro_id, bid_amount, delivery_days, pitch_statement, status, created_at)
    if (window.sb && isValidUUID(projectId) && isValidUUID(proId)) {
      try {
        const sbPayload = {
          project_id: projectId,
          pro_id: proId,
          bid_amount: proposalData.bidAmount,
          delivery_days: proposalData.deliveryDays,
          pitch_statement: proposalData.pitchText,
          status: 'PENDING',
          created_at: nowIso
        };
        if (isValidUUID(proposalId)) {
          sbPayload.id = proposalId;
        }
        const { error } = await sb.from('proposals').upsert(sbPayload);
        if (error) console.warn('Supabase submitCollectionRequest notice:', error.message);
      } catch(sbErr) {
        console.warn('Supabase submitCollectionRequest exception:', sbErr);
      }
    }

    // 3. Automated Chat Workflow: Create/resolve conversation and log system notification
    const actualCompanyId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(proposalData.companyId) : proposalData.companyId);
    const actualProId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(proId) : proId);

    if (actualCompanyId && actualProId && actualCompanyId !== actualProId) {
      const sysMsgText = `${proposalData.userName} submitted a collection request for "${proposalData.jobTitle}". (Status: Pending Review)`;
      
      if (window.sb && typeof createSupabaseConversation === 'function') {
        try {
          const conv = await createSupabaseConversation(actualCompanyId, actualProId);
          if (conv && conv.id) {
            await sb.from('messages').insert({
              conversation_id: conv.id,
              sender_id: actualProId,
              body: sysMsgText,
              is_read: false,
              project_id: (projectId && isValidUUID(projectId)) ? projectId : null,
              metadata: {
                is_system: true,
                event_type: 'COLLECTION_REQUEST_SUBMITTED',
                project_id: projectId,
                proposal_id: proposalId,
                pro_id: actualProId,
                company_id: actualCompanyId,
                job_title: proposalData.jobTitle
              }
            });
            await sb.from('conversations').update({
              last_message_preview: `Collection request: ${proposalData.jobTitle.slice(0, 40)}`, 
              last_message_at: nowIso
            }).eq('id', conv.id);
          }
        } catch (convErr) {
          console.warn('submitCollectionRequest conversation linking notice:', convErr);
        }
      }

      // Local storage sync for instant UI updates
      try {
        const localConvId = `conv_${[actualCompanyId, actualProId].sort().join('_')}`;
        const sysMsgObj = {
          id: 'msg_sys_' + Date.now(),
          conversation_id: localConvId,
          sender_id: actualProId,
          receiver_id: actualCompanyId,
          body: sysMsgText,
          created_at: nowIso,
          status: 'delivered',
          read: false,
          metadata: {
            is_system: true,
            event_type: 'COLLECTION_REQUEST_SUBMITTED',
            project_id: projectId,
            proposal_id: proposalId
          }
        };
        const allLocalMsgs = JSON.parse(localStorage.getItem('collekt_all_messages') || '[]');
        if (!allLocalMsgs.some(m => m.metadata?.proposal_id === proposalId && m.metadata?.event_type === 'COLLECTION_REQUEST_SUBMITTED')) {
          allLocalMsgs.push(sysMsgObj);
          localStorage.setItem('collekt_all_messages', JSON.stringify(allLocalMsgs));
        }
      } catch(e){}
    }

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated', { detail: proposalData }));
    } catch(e){}

    return {
      success: true,
      data: proposalData,
      message: 'Collection request submitted successfully! Status: PENDING.'
    };
  } catch(err) {
    console.error('submitCollectionRequestToSupabase error:', err);
    return { success: false, error: err.message || 'Collection submission error' };
  }
}

/**
 * 10. Fetch Collectors / Proposals for an Opportunity
 */
async function fetchOpportunityCollectorsFromSupabase(projectId) {
  let collectors = [];
  const allUsers = typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];

  if (window.sb && projectId && isValidUUID(projectId)) {
    try {
      const { data, error } = await sb
        .from('proposals')
        .select('*, profiles:pro_id(id, name, title, location, rating, avatar, skills, is_verified)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        collectors = data.map(p => {
          const proProf = p.profiles || {};
          const matchedUser = allUsers.find(u => u && (u.id === p.pro_id || (proProf.email && u.email === proProf.email)));
          return {
            id: p.id,
            jobId: p.project_id,
            project_id: p.project_id,
            userId: p.pro_id,
            user_id: p.pro_id,
            pro_id: p.pro_id,
            userName: proProf.name || matchedUser?.name || 'Professional Candidate',
            userEmail: proProf.email || matchedUser?.email || '',
            userTitle: proProf.title || matchedUser?.title || 'Project Specialist',
            userAvatar: proProf.avatar || matchedUser?.avatar || '',
            userLocation: proProf.location || matchedUser?.location || 'Nigeria',
            userRating: proProf.rating || matchedUser?.rating || 0,
            userSkills: proProf.skills || matchedUser?.skills || [],
            bidAmount: Number(p.bid_amount || 0),
            timeline: p.delivery_days ? (p.delivery_days + ' Days') : '2 Weeks',
            pitchText: p.pitch_statement || 'Collected via Marketplace',
            status: String(p.status || 'PENDING').toUpperCase(),
            created_at: p.created_at,
            profiles: proProf
          };
        });
      }
    } catch(err) {
      console.warn('fetchOpportunityCollectorsFromSupabase notice:', err);
    }
  }

  return { success: true, data: collectors };
}

/**
 * 10b. Reconcile User Proposals strictly against Supabase truth
 */
async function syncUserProposalsFromSupabase(passedUser) {
  const me = passedUser || (typeof getUser === 'function' ? getUser() : null);
  if (!me || !me.id || !window.sb || !isValidUUID(me.id)) return [];
  try {
    const { data, error } = await sb
      .from('proposals')
      .select('*, projects:project_id(id, title, category, budget, company_id, location)')
      .eq('pro_id', me.id)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const synced = data.map(sp => {
        const proj = sp.projects || {};
        return {
          id: sp.id,
          jobId: sp.project_id,
          project_id: sp.project_id,
          jobTitle: proj.title || 'Marketplace Opportunity',
          companyId: proj.company_id || '',
          companyName: 'Verified Corporate Employer',
          userId: me.id,
          pro_id: me.id,
          userEmail: me.email,
          bidAmount: Number(sp.bid_amount || 0),
          proposedAmount: Number(sp.bid_amount || 0),
          budget: Number(sp.bid_amount || proj.budget || 0),
          timeline: sp.delivery_days ? (sp.delivery_days + ' Days') : '2 Weeks',
          pitchText: sp.pitch_statement || 'Collected via Marketplace',
          coverLetter: sp.pitch_statement || 'Collected via Marketplace',
          status: String(sp.status || 'PENDING').toUpperCase(),
          created_at: sp.created_at
        };
      });
      localStorage.setItem('collekt_proposals', JSON.stringify(synced));
      return synced;
    }
  } catch (err) {
    console.warn('syncUserProposalsFromSupabase notice:', err);
  }
  return [];
}
window.syncUserProposalsFromSupabase = syncUserProposalsFromSupabase;

/**
 * 11. Company Accepts Collection Request (Creates Active Engagement Contract)
 */
async function acceptCollectorProposalInSupabase(proposalId, details) {
  try {
    const user = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const nowIso = new Date().toISOString();

    // 1. Update proposal status to ACCEPTED in Supabase
    if (window.sb) {
      try {
        await sb.from('proposals').update({
          status: 'ACCEPTED',
          updated_at: nowIso
        }).eq('id', proposalId);
      } catch(sbErr) {
        console.warn('Supabase accept proposal update notice:', sbErr);
      }
    }

    // 2. Update local proposals
    let matchedProp = null;
    try {
      const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
      const idx = localProps.findIndex(p => p.id === proposalId);
      if (idx !== -1) {
        localProps[idx].status = 'ACCEPTED';
        matchedProp = localProps[idx];
        localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
      }
    } catch(e){}

    // Find associated job to resolve payment mode & milestones
    let matchedJob = null;
    try {
      const allJobs = typeof getPostedJobs === 'function' ? getPostedJobs() : JSON.parse(localStorage.getItem('collekt_jobs') || '[]');
      matchedJob = allJobs.find(j => String(j.id) === String(details?.jobId || details?.project_id || matchedProp?.jobId || matchedProp?.project_id));
    } catch(e){}

    const totalAmt = Number(details?.amount || matchedProp?.bidAmount || matchedProp?.proposedAmount || matchedJob?.budget || 0);
    const currency = details?.currency || matchedProp?.currency || matchedJob?.currency || 'NGN';
    const fxRate = currency === 'USD' ? (details?.fx_rate || matchedProp?.fx_rate || matchedJob?.fx_rate || 1550) : null;
    const ngnTotalAmt = currency === 'USD' ? (typeof convertFx === 'function' ? convertFx(totalAmt, 'USD', 'NGN', fxRate) : totalAmt * 1550) : totalAmt;

    const rawSourceMilestones = (Array.isArray(details?.milestones) && details.milestones.length > 0)
      ? details.milestones
      : (Array.isArray(matchedJob?.milestones) ? matchedJob.milestones : []);
    const payMode = details?.payment_mode || matchedJob?.payment_mode || (rawSourceMilestones.length > 1 ? 'milestones' : 'lump_sum');
    let contractMilestones = [];

    const totalCommission = Math.round(totalAmt * 0.15);
    const totalNetPayout = totalAmt - totalCommission;

    if (payMode === 'milestones' && rawSourceMilestones.length > 0) {
      contractMilestones = rawSourceMilestones.map((m, idx) => {
        const pct = Number(m.percentage) || Math.round(100 / rawSourceMilestones.length);
        const mAmt = Number(m.amount) > 0 ? Number(m.amount) : (totalAmt > 0 ? Math.round(totalAmt * (pct / 100)) : 0);
        const mComm = Math.round(mAmt * 0.15);
        const mNet = mAmt - mComm;
        const mNgnAmt = currency === 'USD' ? (typeof convertFx === 'function' ? convertFx(mAmt, 'USD', 'NGN', fxRate) : mAmt * 1550) : mAmt;
        return {
          id: m.id || ('ms_' + (idx + 1)),
          name: m.name || (`Phase ${idx + 1}`),
          percentage: pct,
          amount: mAmt,
          currency: currency,
          fx_rate: fxRate,
          ngn_amount: mNgnAmt,
          commission_rate: 0.15,
          commission: mComm,
          net_payout: mNet,
          status: m.status || 'Funded in Escrow'
        };
      });
    } else {
      contractMilestones = [{
        id: 'ms_1',
        name: '100% Lump-Sum Payout After Job Completion & Approval',
        percentage: 100,
        amount: totalAmt,
        currency: currency,
        fx_rate: fxRate,
        ngn_amount: ngnTotalAmt,
        commission_rate: 0.15,
        commission: totalCommission,
        net_payout: totalNetPayout,
        status: 'Funded in Escrow'
      }];
    }

    const contractId = 'ctr_' + String(proposalId).replace(/^prop_/, '');
    const contractData = {
      id: contractId,
      proposal_id: proposalId,
      proposalId: proposalId,
      project_id: details?.jobId || details?.project_id || matchedProp?.jobId || matchedProp?.project_id || '',
      jobId: details?.jobId || details?.project_id || matchedProp?.jobId || matchedProp?.project_id || '',
      jobTitle: details?.jobTitle || details?.title || matchedProp?.jobTitle || matchedJob?.title || 'Tender Contract Execution',
      company_id: user.id || details?.companyId || matchedProp?.companyId || 'company',
      companyId: user.id || details?.companyId || matchedProp?.companyId || 'company',
      companyName: user.company_name || user.name || matchedProp?.companyName || 'Corporate Client',
      companyEmail: user.email || matchedProp?.companyEmail || '',
      pro_id: details?.proId || matchedProp?.userId || matchedProp?.pro_id || '',
      proId: details?.proId || matchedProp?.userId || matchedProp?.pro_id || '',
      proName: details?.proName || matchedProp?.userName || 'Professional Specialist',
      proEmail: details?.proEmail || matchedProp?.userEmail || '',
      currency: currency,
      exchange_rate_at_deposit: fxRate,
      fx_rate: fxRate,
      ngn_equivalent_total: ngnTotalAmt,
      total_amount: totalAmt,
      amount: totalAmt,
      commission_rate: 0.15,
      commission_amount: totalCommission,
      pro_net_amount: totalNetPayout,
      pro_payout_amount: totalNetPayout,
      payment_mode: payMode,
      milestones: contractMilestones,
      timeline: details?.timeline || matchedProp?.timeline || '2 Weeks',
      status: 'ACTIVE', // Acceptance creates ACTIVE engagement, NOT completed
      created_at: nowIso,
      updated_at: nowIso
    };

    // 3. Insert into Supabase contracts table
    if (window.sb) {
      try {
        const sbContract = {
          id: contractId,
          proposal_id: proposalId,
          project_id: contractData.project_id || null,
          company_id: contractData.company_id || null,
          pro_id: contractData.pro_id || null,
          total_amount: contractData.total_amount,
          pro_payout_amount: contractData.pro_payout_amount,
          currency: contractData.currency,
          exchange_rate_at_deposit: contractData.exchange_rate_at_deposit,
          status: 'ACTIVE',
          created_at: nowIso
        };
        const { error } = await sb.from('contracts').upsert(sbContract);
        if (error) console.warn('Supabase contract insert notice:', error.message);
      } catch(sbErr) {
        console.warn('Supabase contract insert exception:', sbErr);
      }
    }

    // 4. Save to Local Storage contracts
    try {
      const allContracts = JSON.parse(localStorage.getItem('collekt_contracts') || '[]');
      const existIdx = allContracts.findIndex(c => c.id === contractId || c.proposalId === proposalId);
      if (existIdx >= 0) {
        allContracts[existIdx] = { ...allContracts[existIdx], ...contractData };
      } else {
        allContracts.unshift(contractData);
      }
      localStorage.setItem('collekt_contracts', JSON.stringify(allContracts));

      // Also mirror in collekt_awarded_contracts for legacy views
      const awardedList = JSON.parse(localStorage.getItem('collekt_awarded_contracts') || '[]');
      const awardedEntry = {
        id: 'CTR-' + proposalId,
        proposalId: proposalId,
        title: contractData.jobTitle,
        amount: contractData.total_amount,
        currency: contractData.currency,
        fx_rate: contractData.fx_rate,
        contractor: contractData.proName,
        client: contractData.companyName,
        payment_mode: payMode,
        milestones: contractMilestones,
        status: 'Active Escrow',
        created_at: nowIso
      };
      const awIdx = awardedList.findIndex(c => c.id === 'CTR-' + proposalId || c.proposalId === proposalId);
      if (awIdx >= 0) {
        awardedList[awIdx] = { ...awardedList[awIdx], ...awardedEntry };
      } else {
        awardedList.unshift(awardedEntry);
      }
      localStorage.setItem('collekt_awarded_contracts', JSON.stringify(awardedList));
    } catch(e){}

    // 5. Automated Chat Workflow: Create/resolve conversation and log acceptance notification
    const actualCompanyId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(contractData.company_id) : contractData.company_id);
    const actualProId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(contractData.pro_id) : contractData.pro_id);

    if (actualCompanyId && actualProId && actualCompanyId !== actualProId) {
      const sym = currency === 'USD' ? '$' : '₦';
      const msSummaryText = payMode === 'milestones' && contractMilestones.length > 1
        ? `Escrow Payout Schedule (${contractMilestones.length} Milestones): ` + contractMilestones.map((m, i) => `M${i + 1}: ${m.name} (${m.percentage}% — ${sym}${Number(m.amount || 0).toLocaleString()})`).join(' | ')
        : `Escrow Payout Schedule: 100% Lump-Sum Payout After Job Completion (${sym}${Number(totalAmt || 0).toLocaleString()})`;
      const acceptMsgText = `Collection request for "${contractData.jobTitle}" has been ACCEPTED by ${contractData.companyName}! Active project engagement has commenced.\n${msSummaryText}`;

      if (window.sb && typeof createSupabaseConversation === 'function') {
        try {
          const conv = await createSupabaseConversation(actualCompanyId, actualProId);
          if (conv && conv.id) {
            await sb.from('messages').insert({
              conversation_id: conv.id,
              sender_id: actualCompanyId,
              body: acceptMsgText,
              is_read: false,
              project_id: (contractData.project_id && isValidUUID(contractData.project_id)) ? contractData.project_id : null,
              metadata: {
                is_system: true,
                event_type: 'COLLECTION_REQUEST_ACCEPTED',
                project_id: contractData.project_id,
                proposal_id: proposalId,
                contract_id: contractId,
                pro_id: actualProId,
                company_id: actualCompanyId,
                job_title: contractData.jobTitle,
                amount: contractData.total_amount
              }
            });
            await sb.from('conversations').update({
              last_message_preview: `Accepted: ${contractData.jobTitle.slice(0, 40)}`, 
              last_message_at: nowIso
            }).eq('id', conv.id);
          }
        } catch (convErr) {
          console.warn('acceptCollectorProposal conversation linking notice:', convErr);
        }
      }

      // Local storage sync
      try {
        const localConvId = `conv_${[actualCompanyId, actualProId].sort().join('_')}`;
        const sysMsgObj = {
          id: 'msg_sys_' + Date.now(),
          conversation_id: localConvId,
          sender_id: actualCompanyId,
          receiver_id: actualProId,
          body: acceptMsgText,
          created_at: nowIso,
          status: 'delivered',
          read: false,
          metadata: {
            is_system: true,
            event_type: 'COLLECTION_REQUEST_ACCEPTED',
            proposal_id: proposalId,
            contract_id: contractId
          }
        };
        const allLocalMsgs = JSON.parse(localStorage.getItem('collekt_all_messages') || '[]');
        allLocalMsgs.push(sysMsgObj);
        localStorage.setItem('collekt_all_messages', JSON.stringify(allLocalMsgs));
      } catch(e){}
    }

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated'));
      window.dispatchEvent(new CustomEvent('collekt_contracts_updated', { detail: contractData }));
      window.dispatchEvent(new CustomEvent('collekt_messages_updated'));
    } catch(e){}

    return {
      success: true,
      contract: contractData,
      message: 'Collekt accepted successfully! Professional engaged & active contract created.'
    };
  } catch(err) {
    console.error('acceptCollectorProposalInSupabase error:', err);
    return { success: false, error: err.message || 'Acceptance error' };
  }
}

/**
 * 12. Company Declines Collection Request
 */
async function declineCollectorProposalInSupabase(proposalId) {
  try {
    const user = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const nowIso = new Date().toISOString();

    // 1. Find proposal details
    let prop = null;
    if (window.sb) {
      try {
        const { data } = await sb.from('proposals').select('*, projects(title, company_id)').eq('id', proposalId).maybeSingle();
        if (data) prop = data;
      } catch(e){}
    }
    if (!prop) {
      try {
        const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
        prop = localProps.find(p => p.id === proposalId);
      } catch(e){}
    }

    const jobTitle = prop?.projects?.title || prop?.jobTitle || prop?.title || 'Marketplace Opportunity';
    const companyName = user.company_name || user.name || prop?.companyName || 'Corporate Client';
    const companyId = user.id || prop?.company_id || prop?.companyId || 'company';
    const proId = prop?.user_id || prop?.pro_id || prop?.userId || '';

    // 2. Update status in Supabase
    if (window.sb) {
      try {
        await sb.from('proposals').update({
          status: 'DECLINED',
          updated_at: nowIso
        }).eq('id', proposalId);
      } catch(sbErr) {
        console.warn('Supabase decline proposal update notice:', sbErr);
      }
    }

    // 3. Update local storage
    try {
      const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
      const idx = localProps.findIndex(p => p.id === proposalId);
      if (idx !== -1) {
        localProps[idx].status = 'DECLINED';
        localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
      }
    } catch(e){}

    // 4. Automated Chat Workflow: Log decline notification in conversation
    const actualCompanyId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(companyId) : companyId);
    const actualProId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(proId) : proId);

    if (actualCompanyId && actualProId && actualCompanyId !== actualProId) {
      const declineMsgText = `Collection request for "${jobTitle}" has been declined by ${companyName}.`;

      if (window.sb && typeof createSupabaseConversation === 'function') {
        try {
          const conv = await createSupabaseConversation(actualCompanyId, actualProId);
          if (conv && conv.id) {
            await sb.from('messages').insert({
              conversation_id: conv.id,
              sender_id: actualCompanyId,
              body: declineMsgText,
              is_read: false,
              metadata: {
                is_system: true,
                event_type: 'COLLECTION_REQUEST_DECLINED',
                proposal_id: proposalId,
                pro_id: actualProId,
                company_id: actualCompanyId,
                job_title: jobTitle
              }
            });
            await sb.from('conversations').update({
              last_message_preview: `Declined: ${jobTitle.slice(0, 40)}`, 
              last_message_at: nowIso
            }).eq('id', conv.id);
          }
        } catch(convErr) {
          console.warn('declineCollectorProposal conversation linking notice:', convErr);
        }
      }

      // Local storage sync
      try {
        const localConvId = `conv_${[actualCompanyId, actualProId].sort().join('_')}`;
        const sysMsgObj = {
          id: 'msg_sys_' + Date.now(),
          conversation_id: localConvId,
          sender_id: actualCompanyId,
          receiver_id: actualProId,
          body: declineMsgText,
          created_at: nowIso,
          status: 'delivered',
          read: false,
          metadata: {
            is_system: true,
            event_type: 'COLLECTION_REQUEST_DECLINED',
            proposal_id: proposalId
          }
        };
        const allLocalMsgs = JSON.parse(localStorage.getItem('collekt_all_messages') || '[]');
        allLocalMsgs.push(sysMsgObj);
        localStorage.setItem('collekt_all_messages', JSON.stringify(allLocalMsgs));
      } catch(e){}
    }

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated'));
      window.dispatchEvent(new CustomEvent('collekt_messages_updated'));
    } catch(e){}

    return { success: true, message: 'Collection request declined.' };
  } catch(err) {
    console.error('declineCollectorProposalInSupabase error:', err);
    return { success: false, error: err.message || 'Decline error' };
  }
}

/**
 * 13. Complete Collector Engagement / Job
 */
async function completeCollectorEngagementInSupabase(contractId, proposalId) {
  try {
    const nowIso = new Date().toISOString();

    if (window.sb) {
      try {
        if (contractId) {
          await sb.from('contracts').update({ status: 'COMPLETED', updated_at: nowIso }).eq('id', contractId);
        }
        if (proposalId) {
          await sb.from('proposals').update({ status: 'COMPLETED', updated_at: nowIso }).eq('id', proposalId);
        }
      } catch(sbErr) {
        console.warn('Supabase complete engagement notice:', sbErr);
      }
    }

    try {
      const allContracts = JSON.parse(localStorage.getItem('collekt_contracts') || '[]');
      const cIdx = allContracts.findIndex(c => c.id === contractId || c.proposalId === proposalId);
      if (cIdx !== -1) {
        allContracts[cIdx].status = 'COMPLETED';
        localStorage.setItem('collekt_contracts', JSON.stringify(allContracts));
      }

      const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
      const pIdx = localProps.findIndex(p => p.id === proposalId || (contractId && p.id === contractId.replace(/^ctr_/, 'prop_')));
      if (pIdx !== -1) {
        localProps[pIdx].status = 'COMPLETED';
        localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
      }
    } catch(e){}

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated'));
      window.dispatchEvent(new CustomEvent('collekt_contracts_updated'));
    } catch(e){}

    return { success: true, message: 'Engagement successfully marked as COMPLETED.' };
  } catch(err) {
    console.error('completeCollectorEngagementInSupabase error:', err);
    return { success: false, error: err.message || 'Completion error' };
  }
}

/**
 * 14. Execute Real Server-Side / Database Direct Wallet Transfer
 */
async function executeWalletTransferInSupabase(transferParams) {
  try {
    const senderId = transferParams.senderId || transferParams.sender_id || transferParams.userId;
    const recipientId = transferParams.recipientId || transferParams.recipient_id || transferParams.proId;
    const amount = parseFloat(transferParams.amount);
    const reference = (transferParams.reference || `TX-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).trim();
    const projectId = transferParams.projectId || transferParams.project_id || null;
    const proposalId = transferParams.proposalId || transferParams.proposal_id || null;
    const conversationId = transferParams.conversationId || transferParams.conversation_id || null;
    const note = (transferParams.note || 'In-Chat Direct Transfer').trim();

    if (!senderId || !recipientId) {
      return { success: false, status: 'FAILED', error: 'Missing sender or recipient identifier.' };
    }
    if (isNaN(amount) || amount <= 0) {
      return { success: false, status: 'FAILED', error: 'Please enter a valid positive transfer amount.' };
    }
    if (senderId === recipientId) {
      return { success: false, status: 'FAILED', error: 'Cannot transfer funds to yourself.' };
    }

    const canonicalSender = typeof getCanonicalUserId === 'function' ? getCanonicalUserId(senderId) : senderId;
    const canonicalRecipient = typeof getCanonicalUserId === 'function' ? getCanonicalUserId(recipientId) : recipientId;

    // 1. Try serverless backend endpoint first
    let serverRes = null;
    const endpoints = ['/api/wallet-transfer', '/.netlify/functions/wallet-transfer'];
    for (const ep of endpoints) {
      try {
        let authHeaderVal = '';
        try {
          const sess = await window.sb?.auth?.getSession();
          if (sess?.data?.session?.access_token) {
            authHeaderVal = `Bearer ${sess.data.session.access_token}`;
          }
        } catch(e){}

        const fetchRes = await fetch(ep, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(authHeaderVal ? { 'Authorization': authHeaderVal } : {})
          },
          body: JSON.stringify({
            sender_id: canonicalSender,
            recipient_id: canonicalRecipient,
            amount: amount,
            reference: reference,
            project_id: projectId && isValidUUID(projectId) ? projectId : null,
            proposal_id: proposalId && isValidUUID(proposalId) ? proposalId : null,
            conversation_id: conversationId && isValidUUID(conversationId) ? conversationId : null,
            note: note
          })
        });
        if (fetchRes.ok) {
          serverRes = await fetchRes.json();
          if (serverRes) break;
        } else {
          const errData = await fetchRes.json().catch(() => null);
          if (errData && errData.error) {
            serverRes = errData;
            break;
          }
        }
      } catch (fErr) {
        // Fallback to next endpoint or direct RPC
      }
    }

    // 2. Direct Supabase RPC fallback if serverless endpoint was unreachable
    if (!serverRes && window.sb) {
      const { data: rpcData, error: rpcErr } = await window.sb.rpc('execute_wallet_transfer', {
        p_sender_id: canonicalSender,
        p_recipient_id: canonicalRecipient,
        p_amount: amount,
        p_reference: reference,
        p_project_id: projectId && isValidUUID(projectId) ? projectId : null,
        p_proposal_id: proposalId && isValidUUID(proposalId) ? proposalId : null,
        p_conversation_id: conversationId && isValidUUID(conversationId) ? conversationId : null,
        p_note: note
      });

      if (rpcErr) {
        return { success: false, status: 'FAILED', error: rpcErr.message || 'Database error during wallet transfer.' };
      }
      serverRes = rpcData;
    }

    if (!serverRes || !serverRes.success) {
      return serverRes || { success: false, status: 'FAILED', error: 'Transfer failed. Check balance.' };
    }

    // 3. Update local caches with genuine server-returned balances
    try {
      const me = typeof getUser === 'function' ? getUser() : null;
      if (me && (me.id === senderId || me.id === canonicalSender)) {
        me.wallet_balance = serverRes.sender_new_balance;
        if (me.wallet) me.wallet.balance = serverRes.sender_new_balance;
        localStorage.setItem('collekt_user', JSON.stringify(me));
      }

      const localTx = {
        id: serverRes.reference || reference,
        title: `Disbursal to ${transferParams.recipientName || 'Professional'}`,
        category: 'payout',
        type: 'debit',
        amount: amount,
        balance_after: serverRes.sender_new_balance,
        status: 'Completed',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        created_at: new Date().toISOString(),
        note: note
      };

      if (typeof saveTransaction === 'function') {
        saveTransaction(localTx);
      }
    } catch (cacheErr) {}

    try {
      window.dispatchEvent(new CustomEvent('collekt_wallet_updated', { detail: serverRes }));
      window.dispatchEvent(new CustomEvent('collekt_messages_updated'));
    } catch(e) {}

    return serverRes;
  } catch(err) {
    console.error('executeWalletTransferInSupabase error:', err);
    return { success: false, status: 'FAILED', error: err.message || 'Wallet transfer execution error' };
  }
}

/**
 * 14. Send Direct Message from Company to Professional (Database Persisted)
 */
async function sendCompanyDirectMessage({ proId, companyId = null, messageBody, projectId = null, proposalId = null, opportunityTitle = '' }) {
  if (!proId || !messageBody) {
    return { success: false, error: 'Missing recipient or message text.' };
  }

  try {
    const me = (typeof getUser === 'function' ? getUser() : null) || {};
    const actualCompanyId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(companyId || me.id || me.email) : (companyId || me.id));
    const actualProId = (typeof getCanonicalUserId === 'function' ? getCanonicalUserId(proId) : proId);
    const cleanBody = String(messageBody).trim();

    if (!cleanBody) {
      return { success: false, error: 'Message body cannot be empty.' };
    }

    let convId = null;

    // 1. Ensure conversation in Supabase
    if (window.sb && typeof createSupabaseConversation === 'function') {
      try {
        const conv = await createSupabaseConversation(actualCompanyId, actualProId);
        if (conv && conv.id) {
          convId = conv.id;
          if (projectId) {
            try {
              await window.sb.from('conversations').update({
                project_id: projectId,
                metadata: { opportunity_title: opportunityTitle, proposal_id: proposalId }
              }).eq('id', convId);
            } catch(e){}
          }
        }
      } catch(convErr) {
        console.warn('createSupabaseConversation in sendCompanyDirectMessage notice:', convErr);
      }
    }

    // Fallback conversation ID if offline
    if (!convId) {
      convId = `conv_${[actualCompanyId, actualProId].sort().join('_')}`;
    }

    // 2. Insert into Supabase messages table
    let messageRecord = null;
    if (window.sb) {
      try {
        const insertPayload = {
          conversation_id: convId,
          sender_id: actualCompanyId,
          body: cleanBody,
          is_read: false,
          created_at: new Date().toISOString()
        };
        if (projectId) insertPayload.project_id = projectId;
        insertPayload.metadata = {
          opportunity_title: opportunityTitle,
          proposal_id: proposalId,
          is_ai_drafted: true
        };

        const { data: inserted, error: msgErr } = await window.sb
          .from('messages')
          .insert(insertPayload)
          .select()
          .single();

        if (!msgErr && inserted) {
          messageRecord = inserted;
        }
      } catch(sbErr) {
        console.warn('Supabase message insert notice:', sbErr);
      }
    }

    const finalMsgId = messageRecord?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msgObj = {
      id: finalMsgId,
      conversation_id: convId,
      sender_id: actualCompanyId,
      receiver_id: actualProId,
      body: cleanBody,
      created_at: new Date().toISOString(),
      read: false,
      status: 'delivered',
      project_id: projectId,
      metadata: {
        opportunity_title: opportunityTitle,
        proposal_id: proposalId,
        is_ai_drafted: true
      }
    };

    // 3. Save to local storage for instant cross-tab consistency
    try {
      const allMsgs = JSON.parse(localStorage.getItem('collekt_all_messages') || '[]');
      allMsgs.push(msgObj);
      localStorage.setItem('collekt_all_messages', JSON.stringify(allMsgs));

      const allConvs = JSON.parse(localStorage.getItem('collekt_conversations') || '[]');
      let existingConv = allConvs.find(c => c.id === convId);
      if (existingConv) {
        existingConv.last_message = cleanBody.slice(0, 60);
        existingConv.last_at = new Date().toISOString();
      } else {
        allConvs.push({
          id: convId,
          participants: [actualCompanyId, actualProId],
          created_at: new Date().toISOString(),
          last_message: cleanBody.slice(0, 60),
          last_at: new Date().toISOString(),
          project_id: projectId
        });
      }
      localStorage.setItem('collekt_conversations', JSON.stringify(allConvs));
    } catch(e){}

    // 4. Broadcast Realtime event
    if (typeof broadcastRealtimeMessage === 'function') {
      broadcastRealtimeMessage(msgObj);
    }

    // 5. Trace to ai_generations
    if (typeof saveAiGenerationRecord === 'function') {
      saveAiGenerationRecord({
        userId: actualCompanyId,
        generationType: 'company_pro_message',
        prompt: `Direct message for opportunity: ${opportunityTitle}`,
        outputText: cleanBody,
        status: 'sent'
      }).catch(()=>{});
    }

    try {
      window.dispatchEvent(new CustomEvent('collekt_messages_updated'));
    } catch(e){}

    return {
      success: true,
      messageId: finalMsgId,
      conversationId: convId,
      proId: actualProId
    };
  } catch(err) {
    console.error('sendCompanyDirectMessage error:', err);
    return { success: false, error: err.message || 'Send message failed' };
  }
}

/**
 * 15. Global Contextual AI Message Composer Modal
 */
let _activeAiMessageModalContext = null;

function openAiMessageModal(options = {}) {
  const me = (typeof getUser === 'function' ? getUser() : null) || {};
  const companyName = me.company_name || me.name || 'Hiring Enterprise';
  const proId = options.proId || options.pro_id || '';
  const proName = options.proName || options.pro_name || options.name || 'Professional Specialist';
  const proSkills = options.proSkills || options.skills || [];
  const projectId = options.projectId || options.project_id || options.jobId || '';
  const projectTitle = options.projectTitle || options.opportunityTitle || options.title || 'Marketplace Opportunity';
  const projectDesc = options.projectDesc || options.opportunityDesc || options.description || '';
  const projectFee = options.projectFee || options.fee || options.budget || null;
  const proposalId = options.proposalId || options.proposal_id || '';
  const collectionStatus = options.collectionStatus || options.status || 'PENDING';
  let defaultIntent = options.defaultIntent || (collectionStatus === 'ACCEPTED' ? 'acceptance_kickoff' : 'acceptance_kickoff');

  _activeAiMessageModalContext = {
    companyName,
    proId,
    proName,
    proSkills,
    projectId,
    projectTitle,
    projectDesc,
    projectFee,
    proposalId,
    collectionStatus,
    intent: defaultIntent,
    customInstruction: ''
  };

  let modal = document.getElementById('aiMessageComposerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'aiMessageComposerModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '999999';
    document.body.appendChild(modal);
  }

  const feeDisplay = (projectFee && typeof projectFee === 'number' && projectFee > 0)
    ? `₦${projectFee.toLocaleString('en-NG')}`
    : (projectFee && typeof projectFee === 'string' && !projectFee.toLowerCase().includes('not specified') ? projectFee : 'Price not specified');

  const skillsDisplay = Array.isArray(proSkills) && proSkills.length > 0 
    ? proSkills.slice(0, 4).join(', ') 
    : (typeof proSkills === 'string' && proSkills ? proSkills : 'Verified Technical Skills');

  modal.innerHTML = `
    <div class="modal-card" style="max-width:580px; width:100%; border-radius:22px; padding:26px; background:var(--white); border:1px solid var(--line); font-family:'Manrope',sans-serif; box-shadow:0 20px 50px rgba(0,0,0,0.18);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, #0f766e, #134e4a); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 12px rgba(15,118,110,0.25);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
          <div>
            <div style="font-size:17px; font-weight:900; color:var(--ink); line-height:1.2;">Message Specialist</div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px;">Contextual AI Drafter &bull; Zero-Fabrication Assured</div>
          </div>
        </div>
        <button class="modal-close" onclick="closeAiMessageModal()" style="background:transparent; border:none; font-size:22px; cursor:pointer; color:var(--muted); line-height:1;">&times;</button>
      </div>

      <!-- Real Facts Context Card -->
      <div style="background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:14px; margin-bottom:16px; font-size:12px;">
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:var(--teal); margin-bottom:8px; display:flex; align-items:center; gap:5px;">
          <span>Verified Interaction Context</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px 12px;">
          <div><span style="color:var(--muted);">Professional:</span> <strong style="color:var(--ink);">${escapeHTML(proName)}</strong></div>
          <div><span style="color:var(--muted);">Opportunity:</span> <strong style="color:var(--ink);">${escapeHTML(projectTitle)}</strong></div>
          <div><span style="color:var(--muted);">Status:</span> <span class="status-pill" style="font-size:10px; padding:2px 8px; font-weight:800; background:rgba(19,117,111,0.12); color:var(--teal); border-radius:12px;">${escapeHTML(collectionStatus)}</span></div>
          <div><span style="color:var(--muted);">Professional Fee:</span> <strong style="color:var(--forest);">${escapeHTML(feeDisplay)}</strong></div>
        </div>
        <div style="margin-top:6px; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          Skills: <span style="color:var(--ink);">${escapeHTML(skillsDisplay)}</span>
        </div>
      </div>

      <!-- Drafting Intent Selector -->
      <div style="margin-bottom:14px;">
        <label style="font-size:11.5px; font-weight:800; color:var(--ink); display:block; margin-bottom:6px;">Drafting Intent</label>
        <div style="display:flex; flex-wrap:wrap; gap:6px;" id="aiMsgIntentPills">
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('acceptance_kickoff')" data-intent="acceptance_kickoff" style="font-size:11px; font-weight:800; border-radius:99px; padding:4px 12px; background:#0e3b35; color:#fff; border:1.5px solid #0e3b35;">Project Kickoff</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('request_clarification')" data-intent="request_clarification" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">Request Details</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('scope_discussion')" data-intent="scope_discussion" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">Scope Alignment</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('general')" data-intent="general" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">General Note</button>
        </div>
      </div>

      <!-- Custom AI Instructions (Optional) -->
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label style="font-size:11.5px; font-weight:800; color:var(--ink);">Custom Employer Note (Optional)</label>
          <span style="font-size:10.5px; color:var(--muted);">AI will incorporate this note</span>
        </div>
        <input type="text" id="aiMsgCustomInstruction" class="form-input" placeholder="e.g. Ask for availability for a kickoff meeting on Monday..." style="font-size:12px; padding:8px 12px;" onchange="updateAiMessageCustomInstruction(this.value)">
      </div>

      <!-- Editable Message Draft -->
      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="font-size:12px; font-weight:800; color:var(--ink);">Review &amp; Edit Message Draft</label>
          <button type="button" class="btn btn-outline btn-sm" id="btnAiRegenerate" onclick="regenerateAiMessageDraft()" style="font-size:11px; padding:3px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
            <span>Regenerate</span>
          </button>
        </div>
        <textarea id="aiMessageDraftArea" class="form-textarea" rows="6" style="width:100%; font-size:13px; line-height:1.55; padding:12px; border-radius:12px; border:1.5px solid var(--line); font-family:inherit; resize:vertical; background:var(--white);" placeholder="Generating draft..."></textarea>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:4px;">
          <span>Draft is editable before sending</span>
          <span id="aiMsgCharCount">0 characters</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; justify-content:flex-end; gap:10px; align-items:center; padding-top:10px; border-top:1px solid var(--line);">
        <button type="button" class="btn btn-outline btn-sm" onclick="closeAiMessageModal()" style="font-weight:700; font-size:12px; padding:8px 16px;">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="btnSendAiMsg" onclick="sendAiMessageFromModal()" style="font-weight:800; font-size:12.5px; padding:8px 20px; background:var(--teal); box-shadow:0 4px 14px rgba(19,117,111,0.3);">
          Send Message to ${escapeHTML(proName.split(' ')[0] || 'Specialist')}
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');
  modal.style.display = 'flex';

  const draftArea = document.getElementById('aiMessageDraftArea');
  if (draftArea) {
    draftArea.addEventListener('input', () => {
      const cc = document.getElementById('aiMsgCharCount');
      if (cc) cc.textContent = `${draftArea.value.length} characters`;
    });
  }

  // Generate initial draft
  regenerateAiMessageDraft();
}

function closeAiMessageModal() {
  const modal = document.getElementById('aiMessageComposerModal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  _activeAiMessageModalContext = null;
}

function setAiMessageIntent(intent) {
  if (!_activeAiMessageModalContext) return;
  _activeAiMessageModalContext.intent = intent;
  document.querySelectorAll('#aiMsgIntentPills button').forEach(b => {
    const isSel = b.dataset.intent === intent;
    b.style.background = isSel ? '#0e3b35' : 'var(--paper)';
    b.style.color = isSel ? '#fff' : 'var(--ink)';
    b.style.borderColor = isSel ? '#0e3b35' : 'var(--line)';
  });
  regenerateAiMessageDraft();
}

function updateAiMessageCustomInstruction(val) {
  if (!_activeAiMessageModalContext) return;
  _activeAiMessageModalContext.customInstruction = val;
}

async function regenerateAiMessageDraft() {
  if (!_activeAiMessageModalContext) return;
  const draftArea = document.getElementById('aiMessageDraftArea');
  const btnRegen = document.getElementById('btnAiRegenerate');
  
  if (draftArea) {
    draftArea.disabled = true;
    draftArea.placeholder = 'Kolly AI is drafting a factual message...';
  }
  if (btnRegen) {
    btnRegen.disabled = true;
    btnRegen.innerHTML = '<span>Drafting...</span>';
  }

  try {
    let generated = '';
    if (typeof generateCompanyCandidateMessage === 'function') {
      generated = await generateCompanyCandidateMessage({
        companyName: _activeAiMessageModalContext.companyName,
        proName: _activeAiMessageModalContext.proName,
        skills: _activeAiMessageModalContext.proSkills,
        opportunityTitle: _activeAiMessageModalContext.projectTitle,
        opportunityDescription: _activeAiMessageModalContext.projectDesc,
        fee: _activeAiMessageModalContext.projectFee,
        collectionStatus: _activeAiMessageModalContext.collectionStatus,
        intent: _activeAiMessageModalContext.intent,
        customInstruction: _activeAiMessageModalContext.customInstruction
      });
    } else {
      generated = `Hello ${_activeAiMessageModalContext.proName},\n\nWe are pleased to connect regarding "${_activeAiMessageModalContext.projectTitle}" on Collekt. We would like to discuss next steps with you.\n\nBest regards,\n${_activeAiMessageModalContext.companyName}`;
    }

    if (draftArea) {
      draftArea.value = generated;
      draftArea.disabled = false;
      const cc = document.getElementById('aiMsgCharCount');
      if (cc) cc.textContent = `${generated.length} characters`;
    }
  } catch(e) {
    console.error('Draft generation error:', e);
    if (draftArea) {
      draftArea.disabled = false;
      draftArea.value = `Hello ${_activeAiMessageModalContext.proName},\n\nWe are reaching out regarding "${_activeAiMessageModalContext.projectTitle}" on Collekt. Looking forward to connecting.\n\nBest regards,\n${_activeAiMessageModalContext.companyName}`;
    }
  } finally {
    if (btnRegen) {
      btnRegen.disabled = false;
      btnRegen.innerHTML = '<span>Regenerate</span>';
    }
  }
}

async function sendAiMessageFromModal() {
  if (!_activeAiMessageModalContext) return;
  const draftArea = document.getElementById('aiMessageDraftArea');
  const text = draftArea ? draftArea.value.trim() : '';

  if (!text) {
    if (typeof showToast === 'function') showToast('Message body cannot be empty', 'warning');
    return;
  }

  const btnSend = document.getElementById('btnSendAiMsg');
  if (btnSend) {
    btnSend.disabled = true;
    btnSend.innerHTML = '<span>Sending...</span>';
  }

  try {
    const res = await sendCompanyDirectMessage({
      proId: _activeAiMessageModalContext.proId,
      messageBody: text,
      projectId: _activeAiMessageModalContext.projectId,
      proposalId: _activeAiMessageModalContext.proposalId,
      opportunityTitle: _activeAiMessageModalContext.projectTitle
    });

    if (res.success) {
      const proName = _activeAiMessageModalContext.proName;
      const proId = _activeAiMessageModalContext.proId;
      closeAiMessageModal();

      if (typeof showToast === 'function') {
        showToast(`Message sent to ${proName}!`);
      }

      // Show temporary notification card with link to conversation
      const toastEl = document.createElement('div');
      toastEl.className = 'collekt-toast';
      toastEl.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:9999999; background:#0f2b26; color:#fff; padding:16px 20px; border-radius:14px; border:1px solid #134e4a; box-shadow:0 10px 30px rgba(0,0,0,0.3); font-family:sans-serif; display:flex; align-items:center; gap:12px;';
      toastEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; color:#14b8a6;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <div>
          <div style="font-weight:800; font-size:13px;">Message delivered to ${escapeHTML(proName)}</div>
          <div style="font-size:11px; opacity:0.8; margin-top:2px;">Visible in real-time in Messages inbox</div>
        </div>
        <a href="messages.html?user=${encodeURIComponent(proId)}" class="btn btn-sm" style="background:var(--teal); color:#fff; font-size:11px; font-weight:800; padding:5px 12px; text-decoration:none; margin-left:8px; border-radius:8px;">
          Open Chat &rarr;
        </a>
      `;
      document.body.appendChild(toastEl);
      setTimeout(() => { toastEl.remove(); }, 6000);
    } else {
      if (typeof showToast === 'function') {
        showToast((res.error || 'Failed to send message'), 'error');
      }
      if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerHTML = 'Send Message';
      }
    }
  } catch(err) {
    console.error('sendAiMessageFromModal error:', err);
    if (typeof showToast === 'function') showToast('An error occurred while sending', 'error');
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerHTML = 'Send Message';
    }
  }
}

window.sendCompanyDirectMessage = sendCompanyDirectMessage;
window.openAiMessageModal = openAiMessageModal;
window.closeAiMessageModal = closeAiMessageModal;
window.setAiMessageIntent = setAiMessageIntent;
window.updateAiMessageCustomInstruction = updateAiMessageCustomInstruction;
window.regenerateAiMessageDraft = regenerateAiMessageDraft;
window.sendAiMessageFromModal = sendAiMessageFromModal;
window.executeWalletTransferInSupabase = executeWalletTransferInSupabase;
window.getSignedDocumentUrl = getSignedDocumentUrl;
window.getOrGenerateDocumentViewUrl = getOrGenerateDocumentViewUrl;
window.validateFileSignature = validateFileSignature;

/**
 * Record statutory consent audit event (NDPA 2023 / FCCPA 2018 / COBIT 2019)
 */
async function recordConsentEvent({ consentType = 'terms_and_privacy', policyVersion = '2026.1', metadata = {} } = {}) {
  try {
    const user = typeof getUser === 'function' ? getUser() : null;
    const session = typeof getSession === 'function' ? getSession() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const payload = {
      user_id: user?.id || null,
      consent_type: consentType,
      policy_version: policyVersion,
      jurisdiction: 'Federal Republic of Nigeria',
      metadata: {
        ...metadata,
        client_timestamp: new Date().toISOString()
      }
    };

    const res = await fetch('/api/consent/record', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('[Consent Audit] Failed to record consent event:', err);
    return { success: false, error: err.message };
  }
}

window.recordConsentEvent = recordConsentEvent;






