export function canAccessAllData(session) {
  return session?.user?.isAdmin === true;
}

export function isAdminUser(email) {
  const hardcodedAdmins = ['daniel@wolthers.com', 'rasmus@wolthers.com'];
  const envAdmins = process.env.ALLOWED_USERS?.split(',').map(email => email.trim().toLowerCase()) || [];
  const allAdmins = [...hardcodedAdmins, ...envAdmins];
  return email && allAdmins.includes(email.toLowerCase());
}

export function getUserEmailDomain(session) {
  if (!session?.user?.email) return null;
  return session.user.email.split('@')[1];
}

export function filterDataByUser(data, session) {
  if (!session?.user?.email) return [];
  
  // Admin users can see all data
  if (canAccessAllData(session)) {
    return data;
  }
  
  // Regular users can only see their own email data
  const userEmail = session.user.email.toLowerCase();
  const userDomain = getUserEmailDomain(session);
  
  return data.filter(item => {
    // Match exact email or emails from same domain
    const itemEmail = item.email?.toLowerCase();
    const itemDomain = itemEmail?.split('@')[1];
    
    return itemEmail === userEmail || 
           (itemDomain && itemDomain === userDomain);
  });
}