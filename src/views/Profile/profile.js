import { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CModalTitle,
  CContainer,
  CRow,
  CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilHttps, cilPencil } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'
import { supabase } from '../../config/supabaseClient'
import { updateProfileSchema, changePasswordSchema } from '../../schemas/profile.schema'
import './profile.css'

const Profile = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [userInfo, setUserInfo] = useState({})
  const [editInfo, setEditInfo] = useState({})
  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [alertData, setAlertData] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getCurrentUserId = () => userInfo?.id_user ?? userInfo?.id ?? null

  const persistUser = (updatedUser) => {
    setUserInfo(updatedUser)
    localStorage.setItem('userInfo', JSON.stringify(updatedUser))
    sessionStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const handleChangePassword = async () => {
    const result = changePasswordSchema.safeParse(password)

    if (!result.success) {
      const errors = {}
      result.error.errors.forEach((err) => {
        errors[err.path[0]] = err.message
      })
      setFormErrors(errors)
      return
    }

    if (password.newPassword !== password.confirmNewPassword) {
      setFormErrors({ confirmNewPassword: 'Las contraseñas no coinciden.' })
      return
    }

    if (userInfo?.password && password.currentPassword !== userInfo.password) {
      setFormErrors({ currentPassword: 'La contraseña actual no es válida.' })
      return
    }

    setFormErrors({})
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({ password: password.newPassword })
        .eq('id_user', getCurrentUserId())

      if (error) throw error

      const updatedUser = { ...userInfo, password: password.newPassword }
      persistUser(updatedUser)
      setShowPasswordModal(false)
      setPassword({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setAlertData({ response: { message: 'Contraseña actualizada correctamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message || 'No se pudo actualizar la contraseña' }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditInfo = async () => {
    const result = updateProfileSchema.safeParse(editInfo)

    if (!result.success) {
      const errors = {}
      result.error.errors.forEach((err) => {
        errors[err.path[0]] = err.message
      })
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: editInfo.first_name,
          last_name: editInfo.last_name,
          dni: editInfo.dni,
          phone: editInfo.phone,
          email: editInfo.email,
        })
        .eq('id_user', getCurrentUserId())

      if (error) throw error

      const updatedUser = {
        ...userInfo,
        ...editInfo,
      }

      persistUser(updatedUser)
      setShowEditModal(false)
      setAlertData({ response: { message: 'Información actualizada correctamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message || 'No se pudo actualizar la información' }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const storedUser = localStorage.getItem('userInfo') || sessionStorage.getItem('user')

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUserInfo(parsed)
      } catch {
        setUserInfo({})
      }
    }

    setLoadingUser(false)
  }, [])

  const openEditModal = () => {
    setEditInfo({
      first_name: userInfo.first_name || '',
      last_name: userInfo.last_name || '',
      phone: userInfo.phone || '',
      email: userInfo.email || '',
      dni: userInfo.dni || '',
    })
    setFormErrors({})
    setShowEditModal(true)
  }

  return (
    <div className="d-flex justify-content-center align-items-center flex-column">
      <CContainer>
        <CRow className="justify-content-center component-space">
          <CCol xs={12} md={6}>
            <CCard>
              <CCardHeader>
                <h5 className="text-center w-100">Información Personal</h5>
              </CCardHeader>
              <CCardBody>
                <div className="text-center mb-4">
                  <div className="mb-2"><strong>Nombre:</strong> {userInfo?.first_name || 'No disponible'}</div>
                  <div className="mb-2"><strong>Apellido:</strong> {userInfo?.last_name || 'No disponible'}</div>
                  <div className="mb-2"><strong>Teléfono:</strong> {userInfo?.phone || 'No disponible'}</div>
                  <div className="mb-2"><strong>Cédula:</strong> {userInfo?.dni || 'No disponible'}</div>
                  <div className="mb-2"><strong>Email:</strong> {userInfo?.email || 'No disponible'}</div>
                </div>

                <div className="d-flex justify-content-center gap-3">
                  <CButton color="primary" onClick={openEditModal} disabled={loadingUser || isSubmitting}>
                    <CIcon icon={cilPencil} /> Editar Información
                  </CButton>
                  <CButton color="info" className="text-white" onClick={() => setShowPasswordModal(true)} disabled={loadingUser || isSubmitting}>
                    <CIcon icon={cilHttps} className="me-2" />
                    Cambiar Contraseña
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>

      <CModal visible={showPasswordModal} onClose={() => setShowPasswordModal(false)}>
        <CModalHeader>Cambiar Contraseña</CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              type="password"
              label="Contraseña Actual"
              value={password.currentPassword}
              onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })}
              className="mb-3"
              invalid={!!formErrors.currentPassword}
              feedback={formErrors.currentPassword}
            />
            <CFormInput
              type="password"
              label="Nueva Contraseña"
              value={password.newPassword}
              onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
              className="mb-3"
              invalid={!!formErrors.newPassword}
              feedback={formErrors.newPassword}
            />
            <CFormInput
              type="password"
              label="Confirmar Nueva Contraseña"
              value={password.confirmNewPassword}
              onChange={(e) => setPassword({ ...password, confirmNewPassword: e.target.value })}
              className="mb-3"
              invalid={!!formErrors.confirmNewPassword}
              feedback={formErrors.confirmNewPassword}
            />
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleChangePassword} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </CButton>
          <CButton color="secondary" onClick={() => setShowPasswordModal(false)} disabled={isSubmitting}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setFormErrors({})
        }}
      >
        <CModalHeader>Editar Información Personal</CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              label="Nombre"
              value={editInfo.first_name || ''}
              onChange={(e) => setEditInfo({ ...editInfo, first_name: e.target.value })}
              className="mb-2"
              invalid={!!formErrors.first_name}
              feedback={formErrors.first_name}
            />
            <CFormInput
              label="Apellido"
              value={editInfo.last_name || ''}
              onChange={(e) => setEditInfo({ ...editInfo, last_name: e.target.value })}
              className="mb-2"
              invalid={!!formErrors.last_name}
              feedback={formErrors.last_name}
            />
            <CFormInput
              label="Cédula"
              value={editInfo?.dni || ''}
              onChange={(e) => setEditInfo({ ...editInfo, dni: e.target.value })}
              className="mb-2"
              invalid={!!formErrors.dni}
              feedback={formErrors.dni}
            />
            <CFormInput
              label="Teléfono"
              value={editInfo.phone || ''}
              onChange={(e) => setEditInfo({ ...editInfo, phone: e.target.value })}
              className="mb-2"
              invalid={!!formErrors.phone}
              feedback={formErrors.phone}
            />
            <CFormInput
              label="Email"
              value={editInfo.email || ''}
              onChange={(e) => setEditInfo({ ...editInfo, email: e.target.value })}
              className="mb-2"
              invalid={!!formErrors.email}
              feedback={formErrors.email}
            />
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleEditInfo} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </CButton>
          <CButton color="secondary" onClick={() => setShowEditModal(false)} disabled={isSubmitting}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      {alertData && (
        <AlertMessage response={alertData.response} type={alertData.type} onClose={() => setAlertData(null)} />
      )}
    </div>
  )
}

export default Profile