import React from 'react'
import {
  CButton,
  CCol,
  CContainer,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBan, cilHome } from '@coreui/icons'
import { useNavigate } from 'react-router-dom'

const Page404 = () => {
  const navigate = useNavigate()

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center text-center">
          <CCol md={6}>
            <div className="mb-4 text-warning">
              <CIcon icon={cilBan} height={80} />
            </div>
            <h1 className="display-1 fw-bold text-primary mb-2">404</h1>
            <h4 className="fw-semibold mb-3">¡Acceso Restringido o Página no encontrada!</h4>
            <p className="text-body-secondary mb-4">
              Lo sentimos, la página que intentas visitar no existe o no cuentas con los permisos de administrador necesarios para acceder a este módulo.
            </p>
            <div className="d-flex justify-content-center">
              <CButton 
                color="primary" 
                size="lg" 
                className="px-4 d-flex align-items-center gap-2"
                onClick={() => navigate('/sales')}
              >
                <CIcon icon={cilHome} /> Volver al Inicio (Ventas)
              </CButton>
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Page404