import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilUser,
  cilPeople,
  cilCart,
  cilStorage,
  cilSettings,
  cilBriefcase,
  cilBook
} from '@coreui/icons'
import { CNavItem } from '@coreui/react'
import { getCurrentUserRole } from './utils/rolePermissions'

const _nav = () => {
  // Se ejecuta dinámicamente en cada render
  const role = getCurrentUserRole()
  const isAdmin = role === 'admin' || role === 'Administrador'

  return [
    ...(isAdmin ? [{
      component: CNavItem,
      name: 'Dashboard',
      to: '/dashboard',
      icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    }] : []),
    {
      component: CNavItem,
      name: 'Ventas',
      to: '/sales',
      icon: <CIcon icon={cilCart} customClassName="nav-icon" />,
    },
    {
      component: CNavItem,
      name: 'Clientes',
      to: '/customers',
      icon: <CIcon icon={cilBriefcase} customClassName="nav-icon" />,
    },
    {
      component: CNavItem,
      name: 'Inventario',
      to: '/inventory',
      icon: <CIcon icon={cilBook} customClassName="nav-icon" />,
    },
    ...(isAdmin ? [{
      component: CNavItem,
      name: 'Usuarios',
      to: '/users',
      icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    }] : []),
    {
      component: CNavItem,
      name: 'Perfil',
      to: '/profile',
      icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
    },
  ]
}

export default _nav