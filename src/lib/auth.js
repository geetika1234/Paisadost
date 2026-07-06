import { supabase } from './supabase'

// Mobile numbers are turned into virtual emails for Supabase email+password auth.
// This avoids needing Twilio/OTP while keeping mobile as the user identifier.
function toEmail(mobile) {
  return `${mobile.trim()}@arfinanciers.local`
}

export async function signUp({ mobile, name, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: toEmail(mobile),
    password,
  })
  if (error) throw error

  const { error: profileErr } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, mobile: mobile.trim(), fullname: name.trim(), role: 'sales', is_approved: false })
  if (profileErr) throw profileErr

  return data.user
}

export async function signIn({ mobile, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(mobile),
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}
