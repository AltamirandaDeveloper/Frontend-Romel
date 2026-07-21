import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import { supabase } from '../../../config/supabaseClient'
import './Login.css' 

const Login = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.email.trim() || !formData.password.trim()) {
      setStatus({ loading: false, error: 'Por favor completa todos los campos', success: '' })
      return
    }

    setStatus({ loading: true, error: '', success: '' })

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', formData.email.trim())
        .limit(1)

      if (error) throw error

      if (!users || users.length === 0) {
        throw new Error('Credenciales inválidas')
      }

      const user = users[0]

      if (user.password !== formData.password) {
        throw new Error('Credenciales inválidas')
      }

      const authData = {
        token: `supabase-auth-${user.id_user}-${Date.now()}`,
        expiresAt: Date.now() + 1000 * 60 * 60 * 8,
      }

      const userData = {
        id_user: user.id_user,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        dni: user.dni || '',
        phone: user.phone || '',
        role: user.id_rol,
      }

      sessionStorage.setItem('auth', JSON.stringify(authData))
      sessionStorage.setItem('user', JSON.stringify(userData))
      sessionStorage.setItem('token', authData.token)
      localStorage.setItem('userInfo', JSON.stringify(userData))

      setStatus({ loading: false, error: '', success: '¡Inicio de sesión exitoso! Redirigiendo...' })

      setTimeout(() => navigate('/profile', { replace: true }), 1000)
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'Error al conectar con Supabase', success: '' })
      setFormData((prev) => ({ ...prev, password: '' }))
    }
  }

  return (
    <div className="login-page">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup className="login-card">
              <CCard className="login-left">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1 className="login-title">Bienvenido</h1>
                    <p className="login-subtitle">Inicia sesión en tu cuenta</p>

                    {status.error && <CAlert color="danger" className="mb-3">{status.error}</CAlert>}
                    {status.success && <CAlert color="success" className="mb-3">{status.success}</CAlert>}

                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        name="email"
                        type="email"
                        placeholder="Correo electrónico"
                        autoComplete="username"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={status.loading}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        name="password"
                        type="password"
                        placeholder="Contraseña"
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={status.loading}
                        required
                      />
                    </CInputGroup>
                    <CRow>
                      <CCol xs={12}>
                        <CButton color="primary" className="btn-login w-100" type="submit" disabled={status.loading}>
                          {status.loading ? <CSpinner size="sm" /> : 'Iniciar sesión'}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard className="login-right" style={{ width: '45%' }}>
                <CCardBody className="d-flex flex-column justify-content-center align-items-center text-center">
                  <h2>Sistema de Inventario</h2>
                  <p className="mb-0 w-75">
                    Gestiona productos, ventas, clientes, inventario y reportes desde un solo lugar.
                  </p>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login