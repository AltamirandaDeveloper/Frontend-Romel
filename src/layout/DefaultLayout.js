import React, { useEffect } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import routes from '../routes'
import { getCurrentUserRole } from '../utils/rolePermissions'
import { useColorModes } from '@coreui/react'

import Page404 from '../views/pages/page404/Page404'

import { AppSidebar, AppHeader, AppFooter } from '../components/index'

const DefaultLayout = () => {
  const { setColorMode } = useColorModes('coreui-free-react-admin-template-theme')

  useEffect(() => {
    setColorMode('light')
  }, [setColorMode])

  const role = getCurrentUserRole()
  const isAdmin = role === 'admin' || role === 'Administrador'

  return (
    <div>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <div className="body flex-grow-1 px-3">
          <Routes>
            {routes.map((route, idx) => {
              // Si la ruta es solo para admin y el usuario NO es admin, mostramos la 404
              let ElementToRender = route.element
              if (route.adminOnly && !isAdmin) {
                ElementToRender = Page404
              }

              return (
                ElementToRender && (
                  <Route
                    key={idx}
                    path={route.path}
                    exact={route.exact}
                    name={route.name}
                    element={<ElementToRender />}
                  />
                )
              )
            })}
            <Route path="/" element={<Navigate to="dashboard" replace />} />
            {/* Ruta comodín por si escriben cualquier otra URL inválida */}
            <Route path="*" element={<Page404 />} />
          </Routes>
        </div>
        <AppFooter />
      </div>
    </div>
  )
}
export default DefaultLayout