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
      created_at: new Date().toISOString(),
      ...(profile || {})
    };

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

        if (wallet) {
          profile.wallet_balance = Number(wallet.available_balance || 0);
          profile.escrow_balance = Number(wallet.escrow_balance || 0);
        }

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

function initSupabaseRealtimeMessaging(currentUserId, onNewMessage, onConvUpdate) {
  if (!window.sb || !currentUserId) return null;

  if (_activeRealtimeChannel) {
    try { window.sb.removeChannel(_activeRealtimeChannel); } catch(e){}
    _activeRealtimeChannel = null;
  }

  try {
    const cleanId = String(currentUserId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const channelName = `collekt_chat_realtime_${cleanId}`;
    const channel = window.sb.channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, payload => {
        const msg = payload.new;
        if (typeof onNewMessage === 'function') {
          onNewMessage(msg);
        }
        try { window.dispatchEvent(new CustomEvent('collekt_supabase_new_message', { detail: msg })); } catch(e){}
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

    _activeRealtimeChannel = channel;
    return channel;
  } catch (err) {
    console.warn('initSupabaseRealtimeMessaging error:', err);
    return null;
  }
}

async function fetchUserConversationsFromSupabase(userId) {
  if (!window.sb || !userId) return [];
  try {
    const { data: convs, error } = await sb
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
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
      read: m.is_read,
      status: 'delivered'
    }));
  } catch(err) {
    console.warn('fetchMessagesFromSupabase error:', err);
    return [];
  }
}

async function sendSupabaseMessage(conversationId, senderId, body, mediaUrl = null) {
  if (!window.sb || !conversationId || !senderId || !body) return null;
  try {
    const trimmed = String(body).trim();
    const { data: msg, error } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body: trimmed,
        media_url: mediaUrl,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;

    const preview = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    await sb
      .from('conversations')
      .update({
        last_message_preview: preview,
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    return msg;
  } catch(err) {
    console.warn('sendSupabaseMessage error:', err);
    return null;
  }
}

async function createSupabaseConversation(participantA, participantB) {
  if (!window.sb || !participantA || !participantB) return null;
  try {
    const { data: existingA } = await sb
      .from('conversations')
      .select('*')
      .eq('participant_a', participantA)
      .eq('participant_b', participantB)
      .maybeSingle();

    if (existingA) return existingA;

    const { data: existingB } = await sb
      .from('conversations')
      .select('*')
      .eq('participant_a', participantB)
      .eq('participant_b', participantA)
      .maybeSingle();

    if (existingB) return existingB;

    const { data: newConv, error: insertErr } = await sb
      .from('conversations')
      .insert({
        participant_a: participantA,
        participant_b: participantB,
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
    await sb
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .eq('is_read', false);
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

      return {
        id: p.id,
        title: p.title || 'Untitled Opportunity',
        type: p.opportunity_type || 'Short-Term Job',
        category: p.category || 'EPC & Engineering',
        experience: p.experience_level || 'Senior Specialist (8-14 Years)',
        location: p.location || 'Lagos, Nigeria',
        budget: Number(p.budget || 0),
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

    const payload = {
      company_id: companyId,
      company_name: jobData.company_name || jobData.companyName || user?.company_name || user?.name || 'Collekt Technologies Ltd',
      title: jobData.title,
      description: jobData.description || jobData.scope || '',
      category: jobData.category || 'EPC & Engineering',
      opportunity_type: jobData.type || 'Short-Term Job',
      experience_level: jobData.experience || 'Any Experience Level',
      budget: Number(jobData.budget || 0),
      budget_rate_type: jobData.budget_rate_type || 'Total Contract Budget',
      duration: jobData.duration || 'Flexible',
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
    const payload = {
      title: jobData.title,
      description: jobData.description || jobData.scope || '',
      category: jobData.category || 'EPC & Engineering',
      opportunity_type: jobData.type || 'Short-Term Job',
      experience_level: jobData.experience || 'Any Experience Level',
      budget: Number(jobData.budget || 0),
      budget_rate_type: jobData.budget_rate_type || 'Total Contract Budget',
      duration: jobData.duration || 'Flexible',
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
 * 1. Initialize Server-Side Wallet Funding Checkout
 */
async function initializeWalletFunding({ amount, email, payment_method = 'card', user_id, owner_id, owner_type = 'user' }) {
  try {
    const res = await fetch('/.netlify/functions/paystack-initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        email,
        payment_method,
        user_id,
        owner_id: owner_id || user_id,
        owner_type
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Payment initialization failed');
    }
    return { success: true, data };
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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Payment verification failed');
    }
    return { success: true, data };
  } catch (err) {
    console.error('verifyWalletPayment error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Fetch or Provision Dedicated Virtual Account (DVA)
 */
async function fetchDedicatedVirtualAccount(ownerId) {
  try {
    const res = await fetch(`/.netlify/functions/paystack-dva?owner_id=${encodeURIComponent(ownerId)}`);
    if (res.status === 404) {
      return { success: false, not_found: true };
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch virtual account');
    return { success: true, data: data.virtual_account };
  } catch (err) {
    console.error('fetchDedicatedVirtualAccount error:', err);
    return { success: false, error: err.message };
  }
}

async function provisionDedicatedVirtualAccount(params) {
  try {
    const res = await fetch('/.netlify/functions/paystack-dva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to provision virtual account');
    return { success: true, data: data.virtual_account };
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
  if (!window.sb || !companyId) return { data: [], error: null };
  try {
    const { data, error } = await sb
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  } catch (err) {
    console.error('fetchCompanyMembers error:', err);
    return { data: [], error: err };
  }
}




