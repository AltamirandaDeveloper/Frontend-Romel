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
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash, cilInfo, cilPlus, cilFolderOpen } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { createMallSchema } from '../../schemas/malls.schema'
import { createCustomerSchema, updateCustomerSchema } from '../../schemas/customers.schema'

const Customers = () => {
  const [stores, setStores] = useState([])
  const [malls, setMalls] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [mallModal, setMallModal] = useState(false)
  
  // Modales
  const [viewModal, setViewModal] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  
  const [storeToDelete, setStoreToDelete] = useState(null)
  const [storeToEdit, setStoreToEdit] = useState(null)
  const [alertData, setAlertData] = useState(null)

  const initialStoreState = {
    id_mall: '',
    number_store: '',
    number_customer: '',
    phone: '',
    code_customer: '',
  }

  const initialMallState = {
    name: '',
    address: '',
  }

  const [newStore, setNewStore] = useState(initialStoreState)
  const [newMall, setNewMall] = useState(initialMallState)
  const [formErrors, setFormErrors] = useState({})
  const [mallFormErrors, setMallFormErrors] = useState({})
  const [selectedMallFilter, setSelectedMallFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewStore({ ...newStore, [name]: value })
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' })
    }
  }

  const handleMallInputChange = (e) => {
    const { name, value } = e.target
    setNewMall({ ...newMall, [name]: value })
    if (mallFormErrors[name]) {
      setMallFormErrors({ ...mallFormErrors, [name]: '' })
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

  // Cargar Tiendas (Stores) cruzando con Centros Comerciales (Malls)
  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*, malls(name, address)')
      .order('id_store', { ascending: false })

    if (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } else {
      setStores(data)
    }
  }

  // Cargar Centros Comerciales para el select del formulario
  const fetchMalls = async () => {
    const { data, error } = await supabase.from('malls').select('*')
    if (!error && data) {
      setMalls(data)
    } else {
      setAlertData({ response: { message: 'Error cargando centros comerciales: ' + error.message }, type: 'danger' })
    }
  }

  useEffect(() => {
    fetchStores()
    fetchMalls()
  }, [])

  // Crear Cliente (Tienda)
  const handleAddStore = async () => {
    // const validationErrors = getValidationErrors(createStoreSchema, newStore)
    // if (Object.keys(validationErrors).length > 0) {
    //   setFormErrors(validationErrors)
    //   return
    // }

    const validationErrors = getValidationErrors(createCustomerSchema, newStore)
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        ...newStore,
        id_mall: newStore.id_mall ? Number(newStore.id_mall) : null,
      }

      const { error } = await supabase.from('stores').insert([payload])

      if (error) throw error

      setNewStore(initialStoreState)
      setFormErrors({})
      setAddModal(false)
      fetchStores()
      setAlertData({ response: { message: 'Cliente registrado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Editar Cliente (Tienda)
  const handleEdit = (store) => {
    setStoreToEdit({
      ...store,
      // Aseguramos que el mall se asigne correctamente al select
      id_mall: store.id_mall || '' 
    })
    setEditModal(true)
  }

  const handleSaveEdit = async () => {
    // const validationErrors = getValidationErrors(updateStoreSchema, storeToEdit)
    // if (Object.keys(validationErrors).length > 0) {
    //   setFormErrors(validationErrors)
    //   return
    // }

    const validationErrors = getValidationErrors(updateCustomerSchema, storeToEdit)
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        number_store: storeToEdit.number_store,
        number_customer: storeToEdit.number_customer,
        phone: storeToEdit.phone,
        code_customer: storeToEdit.code_customer,
        id_mall: storeToEdit.id_mall ? Number(storeToEdit.id_mall) : null,
      }

      const { error } = await supabase
        .from('stores')
        .update(payload)
        .eq('id_store', storeToEdit.id_store)

      if (error) throw error

      fetchStores()
      setFormErrors({})
      setEditModal(false)
      setStoreToEdit(null)
      setAlertData({ response: { message: 'Datos del cliente actualizados exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Eliminar Cliente (Hard Delete en este caso, ya que no hay enum status en DBML para stores)
  const handleDelete = (store) => {
    setStoreToDelete(store)
    setDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!storeToDelete) return
    try {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id_store', storeToDelete.id_store)

      if (error) throw error

      setStores(stores.filter((store) => store.id_store !== storeToDelete.id_store))
      setDeleteModal(false)
      setStoreToDelete(null)
      setAlertData({ response: { message: 'Cliente eliminado del sistema' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  const handleView = (store) => {
    setSelectedStore(store)
    setViewModal(true)
  }

  const getFilteredStores = () => {
    const query = searchQuery.trim().toLowerCase()
    return stores.filter((store) => {
      const matchesMall = selectedMallFilter ? String(store.id_mall) === String(selectedMallFilter) : true
      const matchesSearch = query
        ? [store.code_customer, store.number_store]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        : true
      return matchesMall && matchesSearch
    })
  }

  const filteredStores = getFilteredStores()

  const handleAddMall = async () => {
    const validationErrors = getValidationErrors(createMallSchema, newMall)
    if (Object.keys(validationErrors).length > 0) {
      setMallFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('malls').insert([newMall])
      if (error) throw error

      setNewMall(initialMallState)
      setMallFormErrors({})
      setMallModal(false)
      fetchMalls()
      setAlertData({ response: { message: 'Centro comercial agregado correctamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Exportar a Excel
  const exportToExcel = () => {
    const data = stores.map((store) => ({
      'Código Cliente': store.code_customer || 'N/A',
      'Número de Local': store.number_store || 'N/A',
      'RIF / Doc Cliente': store.number_customer || 'N/A',
      'Teléfono': store.phone || 'No disponible',
      'Centro Comercial': store.malls?.name || 'No asignado',
      'Dirección C.C.': store.malls?.address || 'N/A'
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const cols = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => (row[key] ? row[key].toString().length : 0))) + 2,
    }))
    worksheet['!cols'] = cols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes_Tiendas')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
    saveAs(blob, 'clientes_consignacion.xlsx')
  }

  return (
    <div className="p-3">
      <div className="d-flex flex-column flex-md-row justify-content-between mb-3 gap-2">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <CButton color="success" className="text-white me-2" onClick={exportToExcel}>
            <CIcon icon={cilFolderOpen} /> Exportar a Excel
          </CButton>
          <CButton color="warning" className="text-white me-2" onClick={() => setMallModal(true)}>
            <CIcon icon={cilPlus} /> Añadir Centro Comercial
          </CButton>
          <CButton color="primary" onClick={() => setAddModal(true)}>
            <CIcon icon={cilPlus} /> Añadir Local
          </CButton>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <CFormSelect
            value={selectedMallFilter}
            onChange={(e) => setSelectedMallFilter(e.target.value)}
            className="me-2"
          >
            <option value="">Filtrar por Centro Comercial</option>
            {malls.map((mall) => (
              <option key={mall.id_mall} value={mall.id_mall}>
                {mall.name}
              </option>
            ))}
          </CFormSelect>
          <CFormInput
            placeholder="Buscar por código o número de local"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <CCard>
        <CCardBody>
          <CTable striped hover responsive align="middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Código Cliente</CTableHeaderCell>
                <CTableHeaderCell>Centro Comercial</CTableHeaderCell>
                <CTableHeaderCell>N° de Local</CTableHeaderCell>
                <CTableHeaderCell>Doc / RIF</CTableHeaderCell>
                <CTableHeaderCell>Teléfono</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredStores.map((store) => (
                <CTableRow key={store.id_store}>
                  <CTableDataCell className="fw-bold">
                    <CBadge color="dark">{store.code_customer || 'S/C'}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{store.malls?.name || <span className="text-muted">No asignado</span>}</CTableDataCell>
                  <CTableDataCell>{store.number_store || 'N/A'}</CTableDataCell>
                  <CTableDataCell>{store.number_customer || 'N/A'}</CTableDataCell>
                  <CTableDataCell>{store.phone || 'N/A'}</CTableDataCell>
                  <CTableDataCell>
                    <div className="d-flex">
                      <CButton color="primary" size="sm" className="me-2" onClick={() => handleEdit(store)}>
                        <CIcon icon={cilPencil} className="text-white" />
                      </CButton>
                      <CButton color="danger" size="sm" className="me-2" onClick={() => handleDelete(store)}>
                        <CIcon icon={cilTrash} className="text-white" />
                      </CButton>
                      <CButton color="info" size="sm" onClick={() => handleView(store)}>
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

      {/* --- MODAL DETALLES --- */}
      <CModal visible={viewModal} onClose={() => setViewModal(false)}>
        <CModalHeader onClose={() => setViewModal(false)}>
          <CModalTitle>Detalles del Local</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedStore && (
            <ul className="list-group list-group-flush">
              <li className="list-group-item"><strong>Código Asignado:</strong> <CBadge color="primary">{selectedStore.code_customer}</CBadge></li>
              <li className="list-group-item"><strong>Centro Comercial:</strong> {selectedStore.malls?.name || 'No asignado'}</li>
              <li className="list-group-item"><strong>Dirección C.C.:</strong> {selectedStore.malls?.address || 'N/A'}</li>
              <li className="list-group-item"><strong>Número de Local:</strong> {selectedStore.number_store || 'N/A'}</li>
              <li className="list-group-item"><strong>Doc/RIF Cliente:</strong> {selectedStore.number_customer || 'N/A'}</li>
              <li className="list-group-item"><strong>Teléfono Contacto:</strong> {selectedStore.phone || 'No disponible'}</li>
            </ul>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setViewModal(false)}>Cerrar</CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL AÑADIR --- */}
      <CModal visible={addModal} onClose={() => setAddModal(false)}>
        <CModalHeader onClose={() => setAddModal(false)}>
          <CModalTitle>Añadir Nuevo Local (Cliente)</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput label="Código del Cliente (Ej: CL-001)" name="code_customer" value={newStore.code_customer} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.code_customer)} />
            {formErrors.code_customer && <div className="text-danger small mb-2">{formErrors.code_customer}</div>}
            
            <CFormSelect label="Centro Comercial" name="id_mall" value={newStore.id_mall} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.id_mall)}>
              <option value="">Seleccione el Mall</option>
              {malls.map((mall) => (
                <option key={mall.id_mall} value={mall.id_mall}>
                  {mall.name}
                </option>
              ))}
            </CFormSelect>
            {formErrors.id_mall && <div className="text-danger small mb-2">{formErrors.id_mall}</div>}
            {!malls.length && (
              <div className="alert alert-warning small mb-2">
                No hay centros comerciales registrados. Agrega uno primero.
              </div>
            )}

            <CFormInput label="Número del Local (Tienda)" name="number_store" value={newStore.number_store} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.number_store)} />
            {formErrors.number_store && <div className="text-danger small mb-2">{formErrors.number_store}</div>}
            
            <CFormInput label="Doc Identidad / RIF" name="number_customer" value={newStore.number_customer} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.number_customer)} />
            {formErrors.number_customer && <div className="text-danger small mb-2">{formErrors.number_customer}</div>}
            
            <CFormInput label="Teléfono de Contacto" name="phone" value={newStore.phone} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.phone)} />
            {formErrors.phone && <div className="text-danger small mb-2">{formErrors.phone}</div>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAddStore} disabled={isSubmitting || !malls.length}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </CButton>
          <CButton color="secondary" onClick={() => setAddModal(false)} disabled={isSubmitting}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={mallModal} onClose={() => setMallModal(false)}>
        <CModalHeader onClose={() => setMallModal(false)}>
          <CModalTitle>Añadir Centro Comercial</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput label="Nombre del Centro Comercial" name="name" value={newMall.name} onChange={handleMallInputChange} className="mb-2" invalid={Boolean(mallFormErrors.name)} />
            {mallFormErrors.name && <div className="text-danger small mb-2">{mallFormErrors.name}</div>}
            <CFormInput label="Dirección" name="address" value={newMall.address} onChange={handleMallInputChange} className="mb-2" invalid={Boolean(mallFormErrors.address)} />
            {mallFormErrors.address && <div className="text-danger small mb-2">{mallFormErrors.address}</div>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAddMall} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Centro Comercial'}
          </CButton>
          <CButton color="secondary" onClick={() => setMallModal(false)} disabled={isSubmitting}>
            Cancelar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL EDITAR --- */}
      <CModal visible={editModal} onClose={() => setEditModal(false)}>
        <CModalHeader onClose={() => setEditModal(false)}>
          <CModalTitle>Editar Datos del Local</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {storeToEdit && (
            <CForm>
              <CFormInput label="Código del Cliente" value={storeToEdit.code_customer} onChange={(e) => setStoreToEdit({ ...storeToEdit, code_customer: e.target.value })} className="mb-2" invalid={Boolean(formErrors.code_customer)} />
              {formErrors.code_customer && <div className="text-danger small mb-2">{formErrors.code_customer}</div>}

              <CFormSelect label="Centro Comercial" value={storeToEdit.id_mall || ''} onChange={(e) => setStoreToEdit({ ...storeToEdit, id_mall: e.target.value })} className="mb-2" invalid={Boolean(formErrors.id_mall)}>
                <option value="">Seleccione el Mall</option>
                {malls.map((mall) => (
                  <option key={mall.id_mall} value={mall.id_mall}>
                    {mall.name}
                  </option>
                ))}
              </CFormSelect>
              {formErrors.id_mall && <div className="text-danger small mb-2">{formErrors.id_mall}</div>}

              <CFormInput label="Número del Local" value={storeToEdit.number_store} onChange={(e) => setStoreToEdit({ ...storeToEdit, number_store: e.target.value })} className="mb-2" invalid={Boolean(formErrors.number_store)} />
              {formErrors.number_store && <div className="text-danger small mb-2">{formErrors.number_store}</div>}

              <CFormInput label="Doc Identidad / RIF" value={storeToEdit.number_customer} onChange={(e) => setStoreToEdit({ ...storeToEdit, number_customer: e.target.value })} className="mb-2" invalid={Boolean(formErrors.number_customer)} />
              {formErrors.number_customer && <div className="text-danger small mb-2">{formErrors.number_customer}</div>}

              <CFormInput label="Teléfono de Contacto" value={storeToEdit.phone} onChange={(e) => setStoreToEdit({ ...storeToEdit, phone: e.target.value })} className="mb-2" invalid={Boolean(formErrors.phone)} />
              {formErrors.phone && <div className="text-danger small mb-2">{formErrors.phone}</div>}
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

      {/* --- MODAL ELIMINAR --- */}
      <CModal visible={deleteModal} onClose={() => setDeleteModal(false)}>
        <CModalHeader onClose={() => setDeleteModal(false)}>
          <CModalTitle>Confirmar Eliminación</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {storeToDelete && (
            <p>¿Estás seguro de que deseas eliminar el registro del local <strong>{storeToDelete.number_store}</strong> perteneciente al cliente <strong>{storeToDelete.code_customer}</strong>?</p>
          )}
          <div className="alert alert-warning small">
            Nota: Esto eliminará el registro físicamente de la base de datos y podría fallar si el local tiene Notas de Entrega vinculadas.
          </div>
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

export default Customers