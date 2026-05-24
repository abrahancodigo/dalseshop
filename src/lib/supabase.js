import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jqznkokxcdxqvosuwzdq.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxem5rb2t4Y2R4cXZvc3V3emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzc1MjUsImV4cCI6MjA5NTIxMzUyNX0.nxMJ0ONsJWwqQmQ3xfqU7nHU59MquhJjyvym0dpCN7c";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SUPER_ADMIN_EMAIL = "abrahanramos@gmail.com";

export default supabase;
