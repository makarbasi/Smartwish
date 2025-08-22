// Simple ensureUserExists function for public.users FK constraint
const newFunction = `  private async ensureUserExists(userId: string): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    try {
      console.log(\`🔍 Checking if user exists in public.users: \${userId}\`);

      // Check if user exists in public.users table
      const { data: existingUser, error: checkError } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking public.users:', checkError);
        throw new Error(\`Failed to check public.users: \${checkError.message}\`);
      }

      if (!existingUser) {
        throw new Error(\`User \${userId} not found in public.users. User must be registered properly.\`);
      }

      console.log(\`✅ User exists in public.users: \${userId}\`);
      return userId;

    } catch (error) {
      console.error('❌ Error in ensureUserExists:', error);
      throw error;
    }
  }`;

console.log(newFunction);
