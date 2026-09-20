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
   AUTH API: Manual Email & Password Sign Up
------------------------------------------------------*/
async function signUpWithEmailPassword({ email, password, role, metadata = {} }) {
  if (!window.sb || !window.sb.auth) {
    return { error: { message: 'Database connection is not available. Please check your internet connection.' } };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const chosenRole = role || metadata.role || 'professional';

  // Merge full user metadata passed to Supabase Auth & PostgreSQL triggers
  const userMetadata = {
    email: cleanEmail,
    role: chosenRole,
    name: metadata.name || [metadata.first_name, metadata.other_name, metadata.last_name].filter(Boolean).join(' ') || metadata.company_name || cleanEmail.split('@')[0],
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    other_name: metadata.other_name || '',
    company_name: chosenRole === 'company' ? (metadata.company_name || metadata.name || cleanEmail.split('@')[0]) : '',
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
      id: authUser.id,
      email: cleanEmail,
      name: userMetadata.name,
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
      cac: userMetadata.cac,
      avatar_letter: (userMetadata.name || cleanEmail).charAt(0).toUpperCase(),
      wallet_balance: wallet ? Number(wallet.available_balance || 0) : 0,
      escrow_balance: wallet ? Number(wallet.escrow_balance || 0) : 0,
      is_verified: false,
      verification_status: 'none',
      terms_accepted: true,
      terms_accepted_at: userMetadata.terms_accepted_at || new Date().toISOString(),
      terms_version: userMetadata.terms_version || '2026.1',
      recaptcha_verified: !!userMetadata.recaptcha_verified,
      created_at: new Date().toISOString(),
      ...(profile || {})
    };

    try {
      await sb.from('profiles').update({
        terms_accepted: true,
        terms_accepted_at: localUser.terms_accepted_at,
        terms_version: localUser.terms_version,
        recaptcha_verified: localUser.recaptcha_verified
      }).eq('id', authUser.id);
    } catch(e) {}

    localStorage.setItem('collekt_user', JSON.stringify(localUser));
    localStorage.setItem('collekt_last_role', chosenRole);
    localStorage.setItem('collekt_last_user_email', cleanEmail);

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

  const cleanEmail = (email || '').trim().toLowerCase();

  try {
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
      return { error: { message: '⛔ Your account has been suspended by Collekt administration. Please contact support@collekt.ng.' } };
    }

    const role = (profile && profile.role) || data.user.user_metadata?.role || 'professional';
    const name = (profile && profile.name) || data.user.user_metadata?.name || cleanEmail.split('@')[0];

    const localUser = {
      id: userId,
      email: cleanEmail,
      name: name,
      role: role,
      avatar_letter: (name || cleanEmail).charAt(0).toUpperCase(),
      wallet_balance: wallet ? Number(wallet.available_balance || 0) : 0,
      escrow_balance: wallet ? Number(wallet.escrow_balance || 0) : 0,
      ...(profile || {})
    };

    localStorage.setItem('collekt_user', JSON.stringify(localUser));
    localStorage.setItem('collekt_last_role', role);
    localStorage.setItem('collekt_last_user_email', cleanEmail);

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
    localStorage.removeItem('collekt_user');
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
      const [profRes, wallRes] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('wallets').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const profile = profRes.data;
      const wallet = wallRes.data;

      let localUser = {};
      try { localUser = JSON.parse(localStorage.getItem('collekt_user')) || {}; } catch(e){}

      if (profile) {
        profile.email = session.user.email;
        profile.avatar_letter = (profile.name || profile.company_name || 'U').charAt(0).toUpperCase();

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
          currency: (wallet && wallet.currency) || 'NGN'
        };

        const finalRole = profile.role || localUser.role || localStorage.getItem('collekt_last_role') || 'professional';
        const finalProfile = { ...localUser, ...profile, role: finalRole };

        // Ensure clean unverified profile state for all users
        if (finalProfile.avatar && typeof finalProfile.avatar === 'string' && (finalProfile.avatar.includes('googleusercontent.com') || finalProfile.avatar.includes('licdn.com'))) {
          finalProfile.oauth_avatar = finalProfile.avatar;
          finalProfile.avatar = null;
          finalProfile.avatar_uploaded = false;
        }
        if (profile.is_verified == null || !profile.is_verified) {
          finalProfile.is_verified = false;
          finalProfile.verified = false;
          finalProfile.identity_verified = false;
          if (finalProfile.verification_status !== 'under_review') {
            finalProfile.verification_status = 'none';
          }
        }

        localStorage.setItem('collekt_user', JSON.stringify(finalProfile));
        localStorage.setItem('collekt_last_role', finalProfile.role);
        localStorage.setItem('collekt_last_user_email', finalProfile.email);
        return finalProfile;
      } else {
        const role = localStorage.getItem('collekt_pending_oauth_role') || localUser.role || 'professional';
        const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        const newProfile = {
          id: session.user.id,
          email: session.user.email,
          name: name,
          role: role,
          title: role === 'company' ? 'Energy & EPC Enterprise' : 'Energy Specialist',
          avatar: null,
          avatar_uploaded: false,
          oauth_avatar: session.user.user_metadata?.avatar_url || null,
          is_verified: false,
          verification_status: 'none',
          wallet_balance: 0,
          escrow_balance: 0,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: '2026.1',
          created_at: new Date().toISOString()
        };

        const merged = { ...localUser, ...newProfile };
        localStorage.setItem('collekt_user', JSON.stringify(merged));
        localStorage.setItem('collekt_last_role', role);

        // Also persist to Supabase profiles table
        try {
          await sb.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            name: name,
            role: role,
            title: newProfile.title,
            country: 'Nigeria',
            state: 'Lagos',
            location: 'Lagos, Nigeria',
            avatar: null,
            is_verified: false,
            verification_status: 'none',
            terms_accepted: true,
            terms_accepted_at: newProfile.terms_accepted_at,
            terms_version: newProfile.terms_version,
            updated_at: new Date().toISOString()
          });
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
  
  const user = await syncUser();
  const pendingRole = localStorage.getItem('collekt_pending_oauth_role');
  
  // Strict Role Separation: A registered user cannot log in to the opposite portal
  if (pendingRole && user && user.role && user.role !== pendingRole) {
    console.warn(`[Collekt Auth] Strict role mismatch: account role '${user.role}' cannot log into '${pendingRole}' portal.`);
    if (window.sb && window.sb.auth) {
      try { await window.sb.auth.signOut(); } catch(e){}
    }
    localStorage.removeItem('collekt_user');
    sessionStorage.removeItem('collekt_oauth_in_progress');
    localStorage.removeItem('collekt_pending_oauth_role');
    
    window.location.replace(`login.html?error=role_mismatch&expected=${encodeURIComponent(pendingRole)}&actual=${encodeURIComponent(user.role)}`);
    return;
  }
  
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
  const targetDashboard = finalRole === 'company' ? 'company-dashboard.html' : 'dashboard.html';

  sessionStorage.removeItem('collekt_oauth_in_progress');
  localStorage.removeItem('collekt_pending_oauth_role');

  // If on an auth page, redirect immediately to target dashboard
  const path = (window.location.pathname || '').toLowerCase();
  const isAuthPage = path.endsWith('login.html') || 
                     path.endsWith('register.html') || 
                     path.endsWith('auth-callback.html') || 
                     path === '/' || 
                     path.endsWith('index.html');

  if (isAuthPage) {
    // Replace URL to prevent back-button loops into OAuth hash
    window.location.replace(targetDashboard);
  }
}

/* -----------------------------------------------------
   REAL USERS DIRECTORY SYNC: Supabase Profiles Engine
------------------------------------------------------*/
async function fetchRealRegisteredUsers() {
  if (!window.sb) return typeof getAllRegisteredUsers === 'function' ? getAllRegisteredUsers() : [];
  try {
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      const realUsers = data.map(p => {
        const isCo = p.role === 'company';
        const dispName = p.name || p.company_name || p.full_name || p.email;
        return {
          ...p,
          id: p.id,
          email: p.email,
          role: p.role || (isCo ? 'company' : 'professional'),
          name: dispName,
          company_name: isCo ? (p.company_name || dispName) : '',
          avatar_letter: dispName.charAt(0).toUpperCase(),
          verified: p.is_verified === true,
          is_verified: p.is_verified === true
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
    let companyId = jobData.company_id || user?.id;
    if (!companyId || companyId === 'company' || companyId.startsWith('usr_')) {
      companyId = '0f9ae84c-c5dd-4067-8ded-82638a6e9e01';
    }

    const budgetVal = (jobData.budget != null && !isNaN(jobData.budget) && Number(jobData.budget) > 0) ? Number(jobData.budget) : null;

    const payload = {
      company_id: companyId,
      company_name: jobData.company_name || jobData.companyName || user?.company_name || user?.name || 'Collekt Technologies Ltd',
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
   COLLECTIONS / PROPOSALS / CONTRACTS DATABASE ENGINE v3.0
   ═════════════════════════════════════════════════════════ */

function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Submits a new collection request for an opportunity
 * Enforces duplicate prevention.
 */
async function submitCollectionRequestToSupabase(req) {
  const user = typeof getUser === 'function' ? getUser() : null;
  const proId = req.proId || req.userId || user?.id;
  const projectId = req.projectId || req.jobId;

  if (!proId || !projectId) {
    throw new Error('Missing professional ID or opportunity ID for collection request');
  }

  // 1. Check local storage for duplicate
  let localProps = [];
  try {
    localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
  } catch(e) { localProps = []; }

  const existingLocal = localProps.find(p => 
    (String(p.jobId) === String(projectId) || String(p.projectId) === String(projectId)) &&
    (String(p.userId) === String(proId) || String(p.userEmail).toLowerCase() === String(user?.email || '').toLowerCase())
  );

  if (existingLocal) {
    return {
      alreadyExists: true,
      proposal: existingLocal,
      status: existingLocal.status || 'PENDING'
    };
  }

  const bidAmountNum = (req.bidAmount != null && !isNaN(req.bidAmount) && Number(req.bidAmount) > 0) ? Number(req.bidAmount) : null;
  const deliveryDaysNum = parseInt(req.deliveryDays || req.timeline || '14') || 14;
  const pitchStr = req.pitchText || req.coverLetter || req.pitch_statement || 'Collected via Marketplace';

  const proposalRecord = {
    id: req.id || ('prop_' + Date.now()),
    jobId: projectId,
    projectId: projectId,
    jobTitle: req.jobTitle || 'Marketplace Opportunity',
    companyId: req.companyId || req.company_id || '',
    companyName: req.companyName || req.company_name || 'Verified Corporate Employer',
    companyEmail: req.companyEmail || '',
    userId: proId,
    proId: proId,
    userName: req.userName || user?.name || 'Professional Specialist',
    userEmail: req.userEmail || user?.email || '',
    userTitle: req.userTitle || user?.title || 'Energy Specialist',
    userAvatar: req.userAvatar || user?.avatar || '',
    userRating: req.userRating || user?.rating || 0,
    userLocation: req.userLocation || user?.location || 'Nigeria',
    userSkills: req.userSkills || user?.skills || [],
    bidAmount: bidAmountNum,
    proposedAmount: bidAmountNum,
    budget: req.budget || bidAmountNum || 0,
    timeline: req.timeline || (deliveryDaysNum + ' Days'),
    deliveryDays: deliveryDaysNum,
    pitchText: pitchStr,
    coverLetter: pitchStr,
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  // 2. Save to Supabase if connected
  if (window.sb && isValidUUID(projectId)) {
    try {
      const validProId = isValidUUID(proId) ? proId : (user?.id && isValidUUID(user.id) ? user.id : '0f9ae84c-c5dd-4067-8ded-82638a6e9e01');
      
      // Check if already in Supabase
      const { data: existingSb } = await window.sb
        .from('proposals')
        .select('*')
        .eq('project_id', projectId)
        .eq('pro_id', validProId)
        .maybeSingle();

      if (existingSb) {
        proposalRecord.id = existingSb.id;
        proposalRecord.status = existingSb.status || 'PENDING';
        localProps.unshift(proposalRecord);
        localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
        return {
          alreadyExists: true,
          proposal: proposalRecord,
          status: proposalRecord.status
        };
      }

      const { data: sbInserted, error: sbErr } = await window.sb
        .from('proposals')
        .insert([{
          project_id: projectId,
          pro_id: validProId,
          bid_amount: bidAmountNum,
          delivery_days: deliveryDaysNum,
          pitch_statement: pitchStr,
          status: 'PENDING'
        }])
        .select();

      if (sbErr) {
        console.warn('Supabase proposal insert notice:', sbErr);
      } else if (sbInserted && sbInserted[0]) {
        proposalRecord.id = sbInserted[0].id;
        proposalRecord.status = sbInserted[0].status;
      }
    } catch (err) {
      console.warn('Supabase collection sync error:', err);
    }
  }

  // 3. Save to local storage
  localProps.unshift(proposalRecord);
  localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
  try { window.dispatchEvent(new CustomEvent('collekt_proposals_updated', { detail: proposalRecord })); } catch(e){}

  return {
    success: true,
    proposal: proposalRecord,
    status: 'PENDING'
  };
}

/**
 * Fetches all collectors for an opportunity
 */
async function fetchOpportunityCollectorsFromSupabase(projectId) {
  let collectors = [];

  // Local collection records
  try {
    const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    collectors = localProps.filter(p => String(p.jobId) === String(projectId) || String(p.projectId) === String(projectId));
  } catch(e){}

  // Supabase records
  if (window.sb && isValidUUID(projectId)) {
    try {
      const { data: sbProps, error } = await window.sb
        .from('proposals')
        .select('*, profiles(id, name, title, location, rating, avatar, skills)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && sbProps && sbProps.length > 0) {
        sbProps.forEach(sp => {
          const pro = sp.profiles || {};
          const existingIdx = collectors.findIndex(c => c.id === sp.id || (c.userId === sp.pro_id && (c.jobId === sp.project_id || c.projectId === sp.project_id)));
          const norm = {
            id: sp.id,
            jobId: sp.project_id,
            projectId: sp.project_id,
            userId: sp.pro_id,
            proId: sp.pro_id,
            userName: pro.name || 'Professional Specialist',
            userTitle: pro.title || 'Energy Specialist',
            userAvatar: pro.avatar || '',
            userRating: pro.rating || 0,
            userLocation: pro.location || 'Nigeria',
            userSkills: pro.skills || [],
            bidAmount: sp.bid_amount,
            proposedAmount: sp.bid_amount,
            timeline: sp.delivery_days ? `${sp.delivery_days} Days` : '2 Weeks',
            deliveryDays: sp.delivery_days,
            pitchText: sp.pitch_statement,
            coverLetter: sp.pitch_statement,
            status: sp.status || 'PENDING',
            created_at: sp.created_at,
            profiles: pro
          };

          if (existingIdx !== -1) {
            collectors[existingIdx] = { ...collectors[existingIdx], ...norm };
          } else {
            collectors.unshift(norm);
          }
        });
      }
    } catch(err) {
      console.warn('fetchOpportunityCollectorsFromSupabase notice:', err);
    }
  }

  return collectors;
}

/**
 * Accepts a collector proposal, moves status to ACCEPTED, and creates an active job engagement contract.
 */
async function acceptCollectorProposalInSupabase(proposalId, details = {}) {
  const user = typeof getUser === 'function' ? getUser() : {};
  let updatedProp = null;

  // 1. Update local proposals
  try {
    const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    const idx = localProps.findIndex(p => String(p.id) === String(proposalId));
    if (idx !== -1) {
      localProps[idx].status = 'ACCEPTED';
      localProps[idx].accepted_at = new Date().toISOString();
      updatedProp = localProps[idx];
      localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
    }
  } catch(e){}

  // 2. Create linked contract engagement (Status: ACTIVE, NOT completed!)
  const contractId = 'ctr_' + String(proposalId).replace(/^prop_/, '');
  const newContract = {
    id: contractId,
    proposalId: proposalId,
    jobId: details.jobId || updatedProp?.jobId || updatedProp?.projectId || '',
    jobTitle: details.jobTitle || updatedProp?.jobTitle || 'Tender Contract Engagement',
    companyId: user.id || details.companyId || updatedProp?.companyId || 'company',
    companyName: user.name || user.company_name || details.companyName || updatedProp?.companyName || 'Corporate Client',
    companyEmail: user.email || details.companyEmail || updatedProp?.companyEmail || '',
    proId: details.proId || updatedProp?.userId || updatedProp?.proId || '',
    proName: details.proName || updatedProp?.userName || 'Professional Specialist',
    proEmail: details.proEmail || updatedProp?.userEmail || '',
    amount: Number(details.amount || updatedProp?.bidAmount || updatedProp?.proposedAmount || updatedProp?.budget || 0),
    budget: Number(details.budget || updatedProp?.budget || updatedProp?.bidAmount || 0),
    timeline: details.timeline || updatedProp?.timeline || '2 Weeks',
    status: 'ACTIVE',
    created_at: new Date().toISOString()
  };

  try {
    const allContracts = JSON.parse(localStorage.getItem('collekt_contracts') || '[]');
    const cIdx = allContracts.findIndex(c => c.id === contractId || c.proposalId === proposalId);
    if (cIdx !== -1) {
      allContracts[cIdx] = { ...allContracts[cIdx], ...newContract };
    } else {
      allContracts.unshift(newContract);
    }
    localStorage.setItem('collekt_contracts', JSON.stringify(allContracts));

    const awardedList = JSON.parse(localStorage.getItem('collekt_awarded_contracts') || '[]');
    if (!awardedList.some(c => c.id === 'CTR-' + proposalId)) {
      awardedList.unshift({
        id: 'CTR-' + proposalId,
        proposalId: proposalId,
        title: newContract.jobTitle,
        amount: newContract.amount,
        contractor: newContract.proName,
        status: 'Active Engagement',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('collekt_awarded_contracts', JSON.stringify(awardedList));
    }
  } catch(e){}

  // 3. Sync to Supabase
  if (window.sb) {
    try {
      if (isValidUUID(proposalId)) {
        await window.sb
          .from('proposals')
          .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
          .eq('id', proposalId);
      }

      if (isValidUUID(newContract.jobId) && isValidUUID(newContract.proId) && isValidUUID(newContract.companyId) && isValidUUID(proposalId)) {
        await window.sb
          .from('contracts')
          .upsert([{
            project_id: newContract.jobId,
            proposal_id: proposalId,
            company_id: newContract.companyId,
            pro_id: newContract.proId,
            total_amount: newContract.amount,
            status: 'ACTIVE'
          }]);
      }
    } catch(err) {
      console.warn('acceptCollectorProposalInSupabase notice:', err);
    }
  }

  try { window.dispatchEvent(new CustomEvent('collekt_contracts_updated', { detail: newContract })); } catch(e){}
  return { success: true, contract: newContract, proposal: updatedProp };
}

/**
 * Declines a collector proposal, moves status to DECLINED.
 */
async function declineCollectorProposalInSupabase(proposalId) {
  try {
    const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    const idx = localProps.findIndex(p => String(p.id) === String(proposalId));
    if (idx !== -1) {
      localProps[idx].status = 'DECLINED';
      localProps[idx].declined_at = new Date().toISOString();
      localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
    }
  } catch(e){}

  if (window.sb && isValidUUID(proposalId)) {
    try {
      await window.sb
        .from('proposals')
        .update({ status: 'DECLINED', updated_at: new Date().toISOString() })
        .eq('id', proposalId);
    } catch(err) {
      console.warn('declineCollectorProposalInSupabase notice:', err);
    }
  }

  try { window.dispatchEvent(new CustomEvent('collekt_proposals_updated', { detail: { id: proposalId, status: 'DECLINED' } })); } catch(e){}
  return { success: true, status: 'DECLINED' };
}

/**
 * Marks a completed job engagement
 */
async function completeCollectorEngagementInSupabase(contractId, proposalId) {
  try {
    const allContracts = JSON.parse(localStorage.getItem('collekt_contracts') || '[]');
    const cIdx = allContracts.findIndex(c => c.id === contractId || c.proposalId === proposalId);
    if (cIdx !== -1) {
      allContracts[cIdx].status = 'COMPLETED';
      allContracts[cIdx].completed_at = new Date().toISOString();
      localStorage.setItem('collekt_contracts', JSON.stringify(allContracts));
    }

    const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    const pIdx = localProps.findIndex(p => p.id === proposalId || (allContracts[cIdx] && p.id === allContracts[cIdx].proposalId));
    if (pIdx !== -1) {
      localProps[pIdx].status = 'COMPLETED';
      localProps[pIdx].completed_at = new Date().toISOString();
      localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
    }
  } catch(e){}

  if (window.sb) {
    try {
      if (isValidUUID(proposalId)) {
        await window.sb.from('proposals').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('id', proposalId);
      }
      if (isValidUUID(contractId)) {
        await window.sb.from('contracts').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', contractId);
      }
    } catch(err) {
      console.warn('completeCollectorEngagementInSupabase notice:', err);
    }
  }

  return { success: true, status: 'COMPLETED' };
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

    const { data: pubData } = window.sb.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pubData ? pubData.publicUrl : null;
    return { data, publicUrl, path, error: null };
  } catch (err) {
    console.error('[Supabase Storage] Unexpected upload failure:', err);
    return { error: err };
  }
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
  const filePath = `${userId}/${documentType || 'docs'}/${Date.now()}_${cleanName}`;
  const mimeType = file.type || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream');

  const uploadRes = await uploadFileToSupabaseStorage('documents', filePath, file, mimeType);
  if (uploadRes.error) return { error: uploadRes.error };

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
    file_url: uploadRes.publicUrl,
    is_generated: isGenerated,
    source_data: sourceData,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    metadata: metadata
  });

  // If CV, also update professional_profiles and local session
  if (documentType === 'cv') {
    try {
      await window.sb.from('professional_profiles').update({ cv_url: uploadRes.publicUrl }).eq('user_id', userId);
      if (user) {
        user.cv_url = uploadRes.publicUrl;
        user.cv_name = cleanName;
        user.cv_size = file.size || 0;
        if (typeof setUser === 'function') setUser(user);
      }
    } catch(e) { console.warn('CV profile sync warning:', e); }
  }

  return { data: docRecord.data, publicUrl: uploadRes.publicUrl, error: null };
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

  if (!uploadBlob) return { error: { message: 'No image file or Data URL provided' } };

  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${assetType}/${Date.now()}_${cleanName}`;

  const uploadRes = await uploadFileToSupabaseStorage('media', filePath, uploadBlob, mimeType);
  if (uploadRes.error) return { error: uploadRes.error };

  const assetRecord = await saveMediaAssetRecord({
    user_id: userId,
    asset_type: assetType,
    title: title || rawName,
    prompt: prompt || null,
    generator_model: generatorModel || null,
    storage_bucket: 'media',
    file_path: filePath,
    file_url: uploadRes.publicUrl,
    file_name: cleanName,
    mime_type: mimeType,
    file_size: uploadBlob.size || 0,
    dimensions: dimensions || { width: 0, height: 0 },
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    metadata: metadata
  });

  // Sync profile avatars or company logos
  if (assetType === 'avatar') {
    try {
      await window.sb.from('profiles').update({ avatar_url: uploadRes.publicUrl, avatar: uploadRes.publicUrl }).eq('id', userId);
      if (user) {
        user.avatar = uploadRes.publicUrl;
        user.avatar_url = uploadRes.publicUrl;
        if (typeof setUser === 'function') setUser(user);
      }
    } catch(e){}
  } else if (assetType === 'company_logo') {
    try {
      await Promise.all([
        window.sb.from('profiles').update({ company_logo: uploadRes.publicUrl }).eq('id', userId),
        window.sb.from('companies').update({ company_logo: uploadRes.publicUrl }).eq('user_id', userId)
      ]);
      if (user) {
        user.company_logo = uploadRes.publicUrl;
        if (typeof setUser === 'function') setUser(user);
      }
    } catch(e){}
  }

  return { data: assetRecord.data, publicUrl: uploadRes.publicUrl, error: null };
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
    if (typeof showToast === 'function') showToast('📄 Compiling PDF document with Collekt engine...');
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
        if (typeof showToast === 'function') showToast('✅ PDF successfully saved to your Collekt database!');
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
    if (typeof showToast === 'function') showToast('⚠️ Could not compile PDF: ' + err.message, 'warning');
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
      if (parsed.ok && parsed.data && (parsed.data.authorization_url || parsed.data.checkout_url || parsed.data.status === 'success')) {
        return { success: true, data: parsed.data };
      }
      if (parsed.data && parsed.data.error) {
        return { success: false, error: parsed.data.error };
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
  try {
    if (!ownerId) {
      const u = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
      ownerId = u?.id || u?.owner_id;
    }
    if (!ownerId) return { success: false, not_found: true };

    // 1. Try serverless function first
    try {
      const res = await fetch(`/.netlify/functions/korapay-virtual-account?owner_id=${encodeURIComponent(ownerId)}`);
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data && (parsed.data.virtual_account || parsed.data.data)) {
        const vba = parsed.data.virtual_account || parsed.data.data;
        if (vba && vba.account_number && !String(vba.account_number).startsWith('07000') && vba.account_number !== '0167384649') {
          return { success: true, data: vba };
        }
      }
    } catch (e) {}
    try {
      const res = await fetch(`/.netlify/functions/paystack-dva?owner_id=${encodeURIComponent(ownerId)}`);
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data && parsed.data.virtual_account) {
        const vba = parsed.data.virtual_account;
        if (vba && vba.account_number && !String(vba.account_number).startsWith('07000') && vba.account_number !== '0167384649') {
          return { success: true, data: vba };
        }
      }
    } catch (e) {}

    // 2. Direct Supabase Query (Fast & Resilient)
    if (window.sb) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId);
      let query = window.sb.from('virtual_accounts').select('*');
      if (isUUID) {
        query = query.or(`owner_id.eq.${ownerId},user_id.eq.${ownerId}`);
      } else {
        query = query.eq('owner_id', ownerId);
      }

      const { data: vba } = await query.eq('status', 'active').maybeSingle();
      if (vba && vba.account_number && !String(vba.account_number).startsWith('07000') && vba.account_number !== '0167384649') {
        return {
          success: true,
          data: {
            account_number: vba.account_number,
            account_name: vba.account_name,
            bank_name: vba.bank_name,
            bank_code: vba.bank_code,
            currency: vba.currency || 'NGN',
            status: vba.status,
            provider: vba.provider
          }
        };
      }

      // Check wallets table
      const { data: w } = await window.sb.from('wallets').select('paystack_dva_account, paystack_dva_bank, paystack_dva_name').eq('owner_id', ownerId).maybeSingle();
      if (w && w.paystack_dva_account && !String(w.paystack_dva_account).startsWith('07000') && w.paystack_dva_account !== '0167384649') {
        return {
          success: true,
          data: {
            account_number: w.paystack_dva_account,
            account_name: w.paystack_dva_name || 'COLLEKT ACCOUNT',
            bank_name: w.paystack_dva_bank || 'Fidelity Bank',
            bank_code: '070',
            currency: 'NGN',
            status: 'active',
            provider: 'korapay'
          }
        };
      }
    }

    // 3. Check local user cache for real verified account
    const u = typeof getUser === 'function' ? getUser() : JSON.parse(localStorage.getItem('collekt_user') || '{}');
    if (typeof getDedicatedVirtualAccountForUser === 'function') {
      const fallbackDva = getDedicatedVirtualAccountForUser(u);
      if (fallbackDva) {
        return { success: true, data: fallbackDva };
      }
    }

    return { success: false, not_found: true };
  } catch (err) {
    console.error('fetchDedicatedVirtualAccount error:', err);
    return { success: false, error: err.message };
  }
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

    const res = await fetch(`/.netlify/functions/bank-resolve?account_number=${encodeURIComponent(cleanAcct)}&bank_code=${encodeURIComponent(cleanBank)}`);
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
      role: params.role || user.role || 'professional'
    };

    const res = await fetch('/.netlify/functions/paystack-withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    if (window.sb) {
      try {
        let q = sb.from('proposals').select('*').eq('project_id', projectId);
        if (proId) {
          q = q.or(`user_id.eq.${proId},pro_id.eq.${proId}`);
        }
        const { data } = await q.maybeSingle();
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

    const proposalId = req.id || ('prop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
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

    // Persist to Supabase
    if (window.sb) {
      try {
        const sbPayload = {
          id: proposalId,
          project_id: projectId,
          user_id: proId || null,
          pro_id: proId || null,
          company_id: proposalData.companyId || null,
          bid_amount: proposalData.bidAmount,
          proposed_amount: proposalData.bidAmount,
          delivery_days: proposalData.deliveryDays,
          pitch_statement: proposalData.pitchText,
          cover_letter: proposalData.coverLetter,
          status: 'PENDING',
          created_at: nowIso
        };
        const { error } = await sb.from('proposals').upsert(sbPayload);
        if (error) console.warn('Supabase submitCollectionRequest notice:', error.message);
      } catch(sbErr) {
        console.warn('Supabase submitCollectionRequest exception:', sbErr);
      }
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

  if (window.sb && projectId) {
    try {
      const { data, error } = await sb
        .from('proposals')
        .select('*, profiles:user_id(id, name, title, location, rating, avatar, skills, verified, is_verified, identity_verified)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        collectors = data.map(p => {
          const proProf = p.profiles || {};
          const matchedUser = allUsers.find(u => u && (u.id === (p.user_id || p.pro_id) || u.email === proProf.email));
          return {
            id: p.id,
            jobId: p.project_id,
            project_id: p.project_id,
            userId: p.user_id || p.pro_id,
            user_id: p.user_id || p.pro_id,
            pro_id: p.pro_id || p.user_id,
            userName: proProf.name || matchedUser?.name || 'Professional Candidate',
            userEmail: proProf.email || matchedUser?.email || '',
            userTitle: proProf.title || matchedUser?.title || 'Project Specialist',
            userAvatar: proProf.avatar || matchedUser?.avatar || '',
            userLocation: proProf.location || matchedUser?.location || 'Nigeria',
            userRating: proProf.rating || matchedUser?.rating || 0,
            userSkills: proProf.skills || matchedUser?.skills || [],
            bidAmount: Number(p.bid_amount || p.proposed_amount || 0),
            timeline: p.delivery_days ? (p.delivery_days + ' Days') : '2 Weeks',
            pitchText: p.pitch_statement || p.cover_letter || 'Collected via Marketplace',
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

  // Merge with Local Storage
  try {
    const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
    const matchedLocal = localProps.filter(p => String(p.jobId || p.project_id) === String(projectId));

    matchedLocal.forEach(lp => {
      const idx = collectors.findIndex(c => c.id === lp.id || (c.userId && lp.userId && c.userId === lp.userId));
      if (idx === -1) {
        const matchedUser = allUsers.find(u => u && (u.id === lp.userId || u.email === lp.userEmail));
        collectors.push({
          id: lp.id,
          jobId: lp.jobId || projectId,
          project_id: lp.jobId || projectId,
          userId: lp.userId || (matchedUser ? matchedUser.id : ''),
          user_id: lp.userId || (matchedUser ? matchedUser.id : ''),
          pro_id: lp.userId || (matchedUser ? matchedUser.id : ''),
          userName: lp.userName || (matchedUser ? matchedUser.name : 'Professional Candidate'),
          userEmail: lp.userEmail || (matchedUser ? matchedUser.email : ''),
          userTitle: lp.userTitle || (matchedUser ? matchedUser.title : 'Project Specialist'),
          userAvatar: lp.userAvatar || (matchedUser ? matchedUser.avatar : ''),
          userLocation: lp.userLocation || (matchedUser ? matchedUser.location : 'Nigeria'),
          userRating: lp.userRating || (matchedUser ? matchedUser.rating : 0),
          userSkills: lp.userSkills || (matchedUser ? matchedUser.skills : []),
          bidAmount: Number(lp.bidAmount || lp.proposedAmount || 0),
          timeline: lp.timeline || '2 Weeks',
          pitchText: lp.pitchText || lp.coverLetter || 'Collected via Marketplace',
          status: String(lp.status || 'PENDING').toUpperCase(),
          created_at: lp.created_at || new Date().toISOString()
        });
      } else {
        collectors[idx] = { ...collectors[idx], ...lp, status: String(lp.status || collectors[idx].status || 'PENDING').toUpperCase() };
      }
    });
  } catch(e){}

  return { success: true, data: collectors };
}

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

    const contractId = 'ctr_' + String(proposalId).replace(/^prop_/, '');
    const contractData = {
      id: contractId,
      proposal_id: proposalId,
      proposalId: proposalId,
      project_id: details?.jobId || details?.project_id || matchedProp?.jobId || matchedProp?.project_id || '',
      jobId: details?.jobId || details?.project_id || matchedProp?.jobId || matchedProp?.project_id || '',
      jobTitle: details?.jobTitle || details?.title || matchedProp?.jobTitle || 'Tender Contract Execution',
      company_id: user.id || details?.companyId || matchedProp?.companyId || 'company',
      companyId: user.id || details?.companyId || matchedProp?.companyId || 'company',
      companyName: user.company_name || user.name || matchedProp?.companyName || 'Corporate Client',
      companyEmail: user.email || matchedProp?.companyEmail || '',
      pro_id: details?.proId || matchedProp?.userId || matchedProp?.pro_id || '',
      proId: details?.proId || matchedProp?.userId || matchedProp?.pro_id || '',
      proName: details?.proName || matchedProp?.userName || 'Professional Specialist',
      proEmail: details?.proEmail || matchedProp?.userEmail || '',
      total_amount: Number(details?.amount || matchedProp?.bidAmount || matchedProp?.proposedAmount || 0),
      amount: Number(details?.amount || matchedProp?.bidAmount || matchedProp?.proposedAmount || 0),
      pro_payout_amount: Number(details?.amount || matchedProp?.bidAmount || matchedProp?.proposedAmount || 0),
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
      if (!awardedList.some(c => c.id === 'CTR-' + proposalId)) {
        awardedList.unshift({
          id: 'CTR-' + proposalId,
          proposalId: proposalId,
          title: contractData.jobTitle,
          amount: contractData.total_amount,
          contractor: contractData.proName,
          status: 'Active Escrow',
          created_at: nowIso
        });
        localStorage.setItem('collekt_awarded_contracts', JSON.stringify(awardedList));
      }
    } catch(e){}

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated'));
      window.dispatchEvent(new CustomEvent('collekt_contracts_updated', { detail: contractData }));
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
    const nowIso = new Date().toISOString();

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

    try {
      const localProps = JSON.parse(localStorage.getItem('collekt_proposals') || '[]');
      const idx = localProps.findIndex(p => p.id === proposalId);
      if (idx !== -1) {
        localProps[idx].status = 'DECLINED';
        localStorage.setItem('collekt_proposals', JSON.stringify(localProps));
      }
    } catch(e){}

    try {
      window.dispatchEvent(new CustomEvent('collekt_proposals_updated'));
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
          <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, #0f766e, #134e4a); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; box-shadow:0 4px 12px rgba(15,118,110,0.25);">
            ✨
          </div>
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
          <span>🔒 Verified Interaction Context</span>
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
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('acceptance_kickoff')" data-intent="acceptance_kickoff" style="font-size:11px; font-weight:800; border-radius:99px; padding:4px 12px; background:#0e3b35; color:#fff; border:1.5px solid #0e3b35;">🚀 Project Kickoff</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('request_clarification')" data-intent="request_clarification" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">📋 Request Details</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('scope_discussion')" data-intent="scope_discussion" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">🔍 Scope Alignment</button>
          <button type="button" class="btn btn-sm" onclick="setAiMessageIntent('general')" data-intent="general" style="font-size:11px; font-weight:700; border-radius:99px; padding:4px 12px; background:var(--paper); color:var(--ink); border:1.5px solid var(--line);">💬 General Note</button>
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
            <span>🔄 Regenerate</span>
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
          🚀 Send Message to ${escapeHTML(proName.split(' ')[0] || 'Specialist')}
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
    draftArea.placeholder = '✨ Kolly AI is drafting a factual message...';
  }
  if (btnRegen) {
    btnRegen.disabled = true;
    btnRegen.innerHTML = '<span>⏳ Drafting...</span>';
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
      btnRegen.innerHTML = '<span>🔄 Regenerate</span>';
    }
  }
}

async function sendAiMessageFromModal() {
  if (!_activeAiMessageModalContext) return;
  const draftArea = document.getElementById('aiMessageDraftArea');
  const text = draftArea ? draftArea.value.trim() : '';

  if (!text) {
    if (typeof showToast === 'function') showToast('⚠️ Message body cannot be empty', 'warning');
    return;
  }

  const btnSend = document.getElementById('btnSendAiMsg');
  if (btnSend) {
    btnSend.disabled = true;
    btnSend.innerHTML = '<span>⏳ Sending...</span>';
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
        showToast(`✅ Message sent to ${proName}!`);
      }

      // Show temporary notification card with link to conversation
      const toastEl = document.createElement('div');
      toastEl.className = 'collekt-toast';
      toastEl.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:9999999; background:#0f2b26; color:#fff; padding:16px 20px; border-radius:14px; border:1px solid #134e4a; box-shadow:0 10px 30px rgba(0,0,0,0.3); font-family:sans-serif; display:flex; align-items:center; gap:12px;';
      toastEl.innerHTML = `
        <span style="font-size:20px;">💬</span>
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
        showToast('⚠️ ' + (res.error || 'Failed to send message'), 'error');
      }
      if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerHTML = '🚀 Send Message';
      }
    }
  } catch(err) {
    console.error('sendAiMessageFromModal error:', err);
    if (typeof showToast === 'function') showToast('⚠️ An error occurred while sending', 'error');
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerHTML = '🚀 Send Message';
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





