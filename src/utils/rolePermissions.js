export const normalizeUserRole = (value) => {
  const role = String(value || '').trim().toLowerCase()

  if (['admin', 'administrator', 'administrador'].includes(role)) {
    return 'admin'
  }

  if (['employee', 'empleado', 'staff', 'seller'].includes(role)) {
    return 'employee'
  }

  if (role === '1' || role === 'admin') {
    return 'admin'
  }

  if (role === '2' || role === 'employee') {
    return 'employee'
  }

  return 'employee'
}

export const getCurrentUserRole = () => {
  if (typeof window === 'undefined') {
    return 'employee'
  }

  try {
    const rawUser = sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}'
    const parsedUser = JSON.parse(rawUser)
    const roleValue = parsedUser?.role?.name ?? parsedUser?.roleName ?? parsedUser?.role ?? parsedUser?.id_rol ?? parsedUser?.rol
    return normalizeUserRole(roleValue)
  } catch {
    return 'employee'
  }
}

export const isAdminUser = () => getCurrentUserRole() === 'admin'
export const isEmployeeUser = () => getCurrentUserRole() === 'employee'

export const canAccessModule = (allowedRoles = []) => {
  if (!allowedRoles.length) return true
  return allowedRoles.includes(getCurrentUserRole())
}

export const getDefaultRouteForRole = () => {
  return isAdminUser() ? '/dashboard' : '/sales'
}
