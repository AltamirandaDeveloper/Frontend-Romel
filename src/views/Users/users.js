import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient' 
import {
  CCard,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash, cilInfo, cilUserPlus, cilFolderOpen } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { createUserSchema, updateUserSchema } from '../../schemas/users.schema'
import './users.css'

const Users = () => {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  
  const [viewModal, setViewModal] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  
  const [userToDelete, setUserToDelete] = useState(null)
  const [userToEdit, setUserToEdit] = useState(null)
  const [alertData, setAlertData] = useState(null)

  const roleTranslations = {
    admin: 'Administrador',
    employee: 'Empleado',
  }

  const initialState = {
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    email: '',
    password: '',
    id_rol: '',
    status: 'active',
  }

  const [newUser, setNewUser] = useState(initialState)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewUser({ ...newUser, [name]: value })
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' })
    }
  }

  const getValidationErrors = (schema, payload) => {
    try {
      schema.parse(payload)
      return {}
    } catch (error) {
      if (error?.issues) {
        return error.issues.reduce((acc, issue) => {
          const field = issue.path[0]
          acc[field] = issue.message
          return acc
        }, {})
      }
      return {}
    }
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('status', 'active')

    if (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } else {
      setUsers(data)
    }
  }

  const fetchRoles = async () => {
    const { data, error } = await supabase.from('roles').select('*')
    if (!error && data) {
      setRoles(data)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  // Crear Usuario
  const handleAddUser = async () => {
    const validationErrors = getValidationErrors(createUserSchema, {
      ...newUser,
      id_rol: newUser.id_rol,
    })

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{ ...newUser, id_rol: Number(newUser.id_rol) }])
        .select()

      if (error) throw error

      setNewUser(initialState)
      setFormErrors({})
      setAddModal(false)
      fetchUsers()
      setAlertData({ response: { message: 'Usuario creado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (user) => {
    setUserToEdit(user)
    setEditModal(true)
  }

  const handleSaveEdit = async () => {
    const validationErrors = getValidationErrors(updateUserSchema, {
      ...userToEdit,
      id_rol: userToEdit?.id_rol,
    })

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: userToEdit.first_name,
          last_name: userToEdit.last_name,
          dni: userToEdit.dni,
          phone: userToEdit.phone,
          email: userToEdit.email,
          id_rol: Number(userToEdit.id_rol)
        })
        .eq('id_user', userToEdit.id_user)

      if (error) throw error

      fetchUsers()
      setFormErrors({})
      setEditModal(false)
      setUserToEdit(null)
      setAlertData({ response: { message: 'Usuario actualizado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (user) => {
    setUserToDelete(user)
    setDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!userToDelete) return
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'deleted' }) 
        .eq('id_user', userToDelete.id_user)

      if (error) throw error

      setUsers(users.filter((user) => user.id_user !== userToDelete.id_user))
      setDeleteModal(false)
      setUserToDelete(null)
      setAlertData({ response: { message: 'Usuario eliminado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  const handleView = (user) => {
    setSelectedUser(user)
    setViewModal(true)
  }

  const exportToExcel = () => {
    const data = users.map((user) => ({
      Nombre: user.first_name,
      Apellido: user.last_name,
      Cedula: user.dni,
      Teléfono: user.phone || 'No disponible',
      Email: user.email,
      Rol: roleTranslations[user.roles?.name] || user.roles?.name || 'No disponible'
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const cols = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => (row[key] ? row[key].toString().length : 0))) + 2,
    }))
    worksheet['!cols'] = cols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
    saveAs(blob, 'usuarios_consignacion.xlsx')
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-end mb-3">
        <CButton color="success" className="text-white me-2" onClick={exportToExcel}>
          <CIcon icon={cilFolderOpen} /> Exportar a Excel
        </CButton>
        <CButton color="primary" onClick={() => setAddModal(true)}>
          <CIcon icon={cilUserPlus} /> Crear Usuario
        </CButton>
      </div>

      <CCard>
        <CCardBody>
          <CTable striped hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Apellido</CTableHeaderCell>
                <CTableHeaderCell>Teléfono</CTableHeaderCell>
                <CTableHeaderCell>Correo</CTableHeaderCell>
                <CTableHeaderCell>Rol</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {users.map((user) => (
                <CTableRow key={user.id_user}>
                  <CTableDataCell>{user.first_name}</CTableDataCell>
                  <CTableDataCell>{user.last_name}</CTableDataCell>
                  <CTableDataCell>{user.phone || 'N/A'}</CTableDataCell>
                  <CTableDataCell>{user.email}</CTableDataCell>
                  <CTableDataCell>{roleTranslations[user.roles?.name] || user.roles?.name || 'N/A'}</CTableDataCell>
                  <CTableDataCell>
                    <div className="d-flex">
                      <CButton color="primary" size="sm" className="me-2" onClick={() => handleEdit(user)}>
                        <CIcon icon={cilPencil} className="text-white" />
                      </CButton>
                      <CButton color="danger" size="sm" className="me-2" onClick={() => handleDelete(user)}>
                        <CIcon icon={cilTrash} className="text-white" />
                      </CButton>
                      <CButton color="info" size="sm" onClick={() => handleView(user)}>
                        <CIcon icon={cilInfo} className="text-white" />
                      </CButton>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={viewModal} onClose={() => setViewModal(false)}>
        <CModalHeader onClose={() => setViewModal(false)}>
          <CModalTitle>Detalles del Empleado</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedUser && (
            <ul>
              <li><strong>Cédula:</strong> {selectedUser.dni}</li>
              <li><strong>Nombre:</strong> {selectedUser.first_name} {selectedUser.last_name}</li>
              <li><strong>Teléfono:</strong> {selectedUser.phone || 'N/A'}</li>
              <li><strong>Correo:</strong> {selectedUser.email}</li>
              <li><strong>Rol:</strong> {roleTranslations[selectedUser.roles?.name] || selectedUser.roles?.name}</li>
            </ul>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setViewModal(false)}>Cerrar</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={addModal} onClose={() => setAddModal(false)}>
        <CModalHeader onClose={() => setAddModal(false)}>
          <CModalTitle>Añadir Nuevo Usuario</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput label="Cédula" name="dni" value={newUser.dni} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.dni)} />
            {formErrors.dni && <div className="text-danger small mb-2">{formErrors.dni}</div>}
            <CFormInput label="Nombre" name="first_name" value={newUser.first_name} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.first_name)} />
            {formErrors.first_name && <div className="text-danger small mb-2">{formErrors.first_name}</div>}
            <CFormInput label="Apellido" name="last_name" value={newUser.last_name} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.last_name)} />
            {formErrors.last_name && <div className="text-danger small mb-2">{formErrors.last_name}</div>}
            <CFormInput label="Teléfono" name="phone" value={newUser.phone} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.phone)} />
            {formErrors.phone && <div className="text-danger small mb-2">{formErrors.phone}</div>}
            <CFormInput label="Correo Electrónico" name="email" value={newUser.email} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.email)} />
            {formErrors.email && <div className="text-danger small mb-2">{formErrors.email}</div>}
            <CFormInput label="Contraseña" name="password" type="password" value={newUser.password} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.password)} />
            {formErrors.password && <div className="text-danger small mb-2">{formErrors.password}</div>}
            <CFormSelect label="Rol" name="id_rol" value={newUser.id_rol} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.id_rol)}>
              <option value="">Seleccione el rol</option>
              {roles.map((rol) => (
                <option key={rol.role_id} value={rol.role_id}>
                  {roleTranslations[rol.name] || rol.name}
                </option>
              ))}
            </CFormSelect>
            {formErrors.id_rol && <div className="text-danger small mb-2">{formErrors.id_rol}</div>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAddUser} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </CButton>
          <CButton color="secondary" onClick={() => setAddModal(false)} disabled={isSubmitting}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader onClose={() => setEditModal(false)}>
          <CModalTitle>Editar Usuario</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {userToEdit && (
            <CForm>
              <CFormInput label="Cédula" value={userToEdit.dni} onChange={(e) => setUserToEdit({ ...userToEdit, dni: e.target.value })} className="mb-2" invalid={Boolean(formErrors.dni)} />
              {formErrors.dni && <div className="text-danger small mb-2">{formErrors.dni}</div>}
              <CFormInput label="Nombre" value={userToEdit.first_name} onChange={(e) => setUserToEdit({ ...userToEdit, first_name: e.target.value })} className="mb-2" invalid={Boolean(formErrors.first_name)} />
              {formErrors.first_name && <div className="text-danger small mb-2">{formErrors.first_name}</div>}
              <CFormInput label="Apellido" value={userToEdit.last_name} onChange={(e) => setUserToEdit({ ...userToEdit, last_name: e.target.value })} className="mb-2" invalid={Boolean(formErrors.last_name)} />
              {formErrors.last_name && <div className="text-danger small mb-2">{formErrors.last_name}</div>}
              <CFormInput label="Teléfono" value={userToEdit.phone} onChange={(e) => setUserToEdit({ ...userToEdit, phone: e.target.value })} className="mb-2" invalid={Boolean(formErrors.phone)} />
              {formErrors.phone && <div className="text-danger small mb-2">{formErrors.phone}</div>}
              <CFormInput label="Correo Electrónico" value={userToEdit.email} onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })} className="mb-2" invalid={Boolean(formErrors.email)} />
              {formErrors.email && <div className="text-danger small mb-2">{formErrors.email}</div>}
              <CFormSelect label="Rol" value={userToEdit.id_rol || ''} onChange={(e) => setUserToEdit({ ...userToEdit, id_rol: Number(e.target.value) })} className="mb-2" invalid={Boolean(formErrors.id_rol)}>
                <option value="">Seleccione el rol</option>
                {roles.map((rol) => (
                  <option key={rol.role_id} value={rol.role_id}>
                    {roleTranslations[rol.name] || rol.name}
                  </option>
                ))}
              </CFormSelect>
              {formErrors.id_rol && <div className="text-danger small mb-2">{formErrors.id_rol}</div>}
            </CForm>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleSaveEdit} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </CButton>
          <CButton color="secondary" onClick={() => setEditModal(false)} disabled={isSubmitting}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={deleteModal} onClose={() => setDeleteModal(false)}>
        <CModalHeader onClose={() => setDeleteModal(false)}>
          <CModalTitle>Confirmar Eliminación</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {userToDelete && (
            <p>¿Estás seguro de que deseas eliminar al usuario <strong>{userToDelete.first_name} {userToDelete.last_name}</strong>?</p>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="danger" onClick={confirmDelete}>Eliminar</CButton>
          <CButton color="secondary" onClick={() => setDeleteModal(false)}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      {alertData && (
        <AlertMessage response={alertData.response} type={alertData.type} onClose={() => setAlertData(null)} />
      )}
    </div>
  )
}

export default Users