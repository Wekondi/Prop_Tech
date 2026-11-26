// auth.js - shared login/signup logic and session handling.
// Used by login.html and by the dashboards (requireAuth) to protect pages.
// Expects ./supabaseClient.js to export: export const supabase = createClient(URL, ANON_KEY)
import { supabase } from './supabaseClient.js';

// Role is saved in the user's metadata at signup: 'buyer' or 'developer'.
// If Member 1 keeps roles in a `profiles` table instead, change getRole() below.
export function getRole(user) {
  return user?.user_metadata?.role || 'buyer';
}

export function dashboardFor(role) {
  return role === 'developer' ? 'developer-dashboard.html' : 'buyer-dashboard.html';
}

export async function signUp({ fullName, email, password, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
  if (error) throw error;
  return data; // data.session is null if email confirmation is switched on in Supabase
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

export async function getUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

// Call at the top of a protected page, e.g. const user = await requireAuth('developer');
// Sends logged-out visitors to login, and sends users to their own dashboard if the role is wrong.
export async function requireAuth(requiredRole) {
  const user = await getUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  const role = getRole(user);
  if (requiredRole && role !== requiredRole) {
    window.location.href = dashboardFor(role);
    return null;
  }
  return user;
}