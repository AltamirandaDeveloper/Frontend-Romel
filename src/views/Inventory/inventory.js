import { useState, useEffect, useRef } from 'react'
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
  CSpinner
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash, cilInfo, cilPlus, cilPrint } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JsBarcode from 'jsbarcode'
import { createInventorySchema, updateInventorySchema } from '../../schemas/inventory.schema'
import { getCurrentUserRole } from '../../utils/rolePermissions' // Importamos la función de roles

const Inventory = () => {
  // Evaluamos el rol de forma dinámica
  const role = getCurrentUserRole()
  const isAdmin = role === 'admin' || role === 'Administrador'

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-implantacion.onrender.com'

  const [bags, setBags] = useState([])
  const [selectedBag, setSelectedBag] = useState(null)
  
  // Modales
  const [viewModal, setViewModal] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  
  // Estado para el modal de escaneo
  const [scanModal, setScanModal] = useState(false)
  const [addUnitsAmount, setAddUnitsAmount] = useState('')

  // Estado para detalles de consignación/tiendas
  const [consignmentDetails, setConsignmentDetails] = useState([])
  const [isLoadingConsignments, setIsLoadingConsignments] = useState(false)

  const [bagToDelete, setBagToDelete] = useState(null)
  const [bagToEdit, setBagToEdit] = useState(null)
  const [alertData, setAlertData] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('none')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  // Referencias para el escáner de código de barras
  const barcodeBuffer = useRef("")
  const typingTimeout = useRef(null)

  const initialState = {
    code_bar: '',
    model_name: '',
    investment_cost: '',
    sale_price: '',
    total_stock: '',
    image_url: '',
    status: 'active'
  }

  const [newBag, setNewBag] = useState(initialState)

  const fetchBags = async () => {
    const { data, error } = await supabase
      .from('bags')
      .select('*')
      .eq('status', 'active')
      .order('bag_id', { ascending: false })

    if (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } else {
      setBags(data)
    }
  }

  // ==========================================
  // CONSULTAR TIENDAS Y CONSIGNACIONES DEL BOLSO
  // ==========================================
  const fetchConsignmentDetails = async (bagId) => {
    setIsLoadingConsignments(true)
    try {
      const { data, error } = await supabase
        .from('delivery_details')
        .select(`
          detail_id,
          delivered_quantity,
          sold_quantity,
          returned_quantity,
          delivery_notes!inner (
            delivery_id,
            date_delivery,
            id_store,
            stores (
              code_customer,
              malls (
                name
              )
            ),
            invoices (
              payment_status
            )
          )
        `)
        .eq('bag_id', bagId)

      if (error) {
        console.error('Error consultando consignaciones:', error)
        setConsignmentDetails([])
      } else {
        setConsignmentDetails(data || [])
      }
    } catch (err) {
      console.error(err)
      setConsignmentDetails([])
    } finally {
      setIsLoadingConsignments(false)
    }
  }

  const getFilteredSortedBags = () => {
    let result = bags

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((bag) =>
        bag.model_name?.toLowerCase().includes(q) || bag.code_bar?.toLowerCase().includes(q)
      )
    }

    if (sortOption === 'price-desc') {
      result = [...result].sort((a, b) => Number(b.sale_price) - Number(a.sale_price))
    } else if (sortOption === 'price-asc') {
      result = [...result].sort((a, b) => Number(a.sale_price) - Number(b.sale_price))
    } else if (sortOption === 'stock-desc') {
      result = [...result].sort((a, b) => Number(b.total_stock) - Number(a.total_stock))
    } else if (sortOption === 'stock-asc') {
      result = [...result].sort((a, b) => Number(a.total_stock) - Number(b.total_stock))
    }

    return result
  }

  const filteredBags = getFilteredSortedBags()
  const totalPages = Math.max(1, Math.ceil(filteredBags.length / ITEMS_PER_PAGE))
  const displayedBags = filteredBags.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  useEffect(() => {
    fetchBags()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortOption])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

// Listener global para lector de código de barras
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current) {
          // Normalizamos el código reemplazando las barras '/' por guiones '-'
          const scannedCode = barcodeBuffer.current.trim().replace(/\//g, '-');
          const foundBag = bags.find(b => b.code_bar === scannedCode);
          
          if (foundBag) {
            setSelectedBag(foundBag);
            setAddUnitsAmount('');
            setScanModal(true);
          } else {
            setAlertData({ response: { message: `Código no registrado: ${scannedCode}` }, type: 'warning' });
          }
          barcodeBuffer.current = "";
        }
      } else {
        if (e.key.length === 1) {
          barcodeBuffer.current += e.key;
          clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => {
            barcodeBuffer.current = "";
          }, 150);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bags]);

  const generateBarcode = () => {
    return 'BAG-' + Math.floor(Math.random() * 1000000000)
  }

  const handleOpenAddModal = () => {
    setNewBag({ ...initialState, code_bar: generateBarcode() })
    setFormErrors({})
    setImageFile(null)
    setImagePreview(null)
    setAddModal(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewBag({ ...newBag, [name]: value })
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' })
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setImageFile(file || null)
    setFormErrors({ ...formErrors, image_url: '' })

    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    } else {
      setImagePreview(null)
    }
  }

  const uploadImageToBackend = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Fallo al subir la imagen al backend')
    }

    const data = await response.json()
    return data.url
  }

  const getValidationErrors = (schema, payload) => {
    const result = schema.safeParse(payload)
    if (result.success) return {}
    return result.error.issues.reduce((acc, issue) => {
      const field = issue.path[0]
      acc[field] = issue.message
      return acc
    }, {})
  }

  const handleAddBag = async () => {
    const validationErrors = getValidationErrors(createInventorySchema, newBag)
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    try {
      setIsSubmitting(true)
      setIsUploading(Boolean(imageFile))
      let imageUrl = 'https://via.placeholder.com/150' 
      
      if (imageFile) {
        imageUrl = await uploadImageToBackend(imageFile)
      }

      const totalStockNum = Number(newBag.total_stock)

      const payload = {
        code_bar: newBag.code_bar,
        model_name: newBag.model_name,
        investment_cost: Number(newBag.investment_cost),
        sale_price: Number(newBag.sale_price),
        image_url: imageUrl,
        total_stock: totalStockNum,
        warehouse_stock: totalStockNum, 
        consigned_stock: 0, 
        status: 'active'
      }

      const { error } = await supabase.from('bags').insert([payload])

      if (error) throw error

      setAddModal(false)
      fetchBags()
      setAlertData({ response: { message: 'Bolso registrado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsUploading(false)
      setIsSubmitting(false)
    }
  }

  const handleEdit = (bag) => {
    setBagToEdit(bag)
    setFormErrors({})
    setEditModal(true)
  }

  const handleSaveEdit = async () => {
    const validationErrors = getValidationErrors(updateInventorySchema, bagToEdit)
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const totalStockNum = Number(bagToEdit.total_stock)
      const newWarehouseStock = totalStockNum - bagToEdit.consigned_stock

      const { error } = await supabase
        .from('bags')
        .update({
          model_name: bagToEdit.model_name,
          investment_cost: Number(bagToEdit.investment_cost),
          sale_price: Number(bagToEdit.sale_price),
          total_stock: totalStockNum,
          warehouse_stock: newWarehouseStock
        })
        .eq('bag_id', bagToEdit.bag_id)

      if (error) throw error

      fetchBags()
      setEditModal(false)
      setBagToEdit(null)
      setAlertData({ response: { message: 'Bolso actualizado exitosamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (bag) => {
    setBagToDelete(bag)
    setDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!bagToDelete) return
    try {
      const { error } = await supabase
        .from('bags')
        .update({ status: 'deleted' })
        .eq('bag_id', bagToDelete.bag_id)

      if (error) throw error

      fetchBags()
      setDeleteModal(false)
      setBagToDelete(null)
      setAlertData({ response: { message: 'Bolso eliminado del inventario' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  const handleAddUnitsToScannedBag = async () => {
    if (!addUnitsAmount || Number(addUnitsAmount) <= 0) return;

    try {
      const unitsToAdd = Number(addUnitsAmount)
      const newTotalStock = selectedBag.total_stock + unitsToAdd
      const newWarehouseStock = selectedBag.warehouse_stock + unitsToAdd

      const { error } = await supabase
        .from('bags')
        .update({
          total_stock: newTotalStock,
          warehouse_stock: newWarehouseStock
        })
        .eq('bag_id', selectedBag.bag_id)

      if (error) throw error

      fetchBags()
      setScanModal(false)
      setAlertData({ response: { message: `Se añadieron ${unitsToAdd} unidades al modelo ${selectedBag.model_name}` }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  const handleView = (bag) => {
    setSelectedBag(bag)
    setViewModal(true)
    fetchConsignmentDetails(bag.bag_id)
  }

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const exportPrintablePDF = () => {
    const doc = new jsPDF('portrait', 'mm', 'a4')
    doc.text("Catálogo Imprimible para Escaneo de Inventario", 14, 15)

    const tableColumn = ["Nombre del Producto", "Código de Barras"]

    const tableRows = bags.map(bag => [
      bag.model_name,
      ''
    ])

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { valign: 'middle', fontSize: 10 },
      bodyStyles: { minCellHeight: 22 },
      didDrawCell: function (data) {
        if (data.column.index === 1 && data.cell.section === 'body') {
          const bag = bags[data.row.index]
          const canvas = document.createElement('canvas')
          
          JsBarcode(canvas, bag.code_bar, {
            format: "CODE128",
            displayValue: true,
            height: 45,
            width: 1.5,
            margin: 0,
            fontSize: 12
          })

          const imgData = canvas.toDataURL("image/png")
          const x = data.cell.x + 2
          const y = data.cell.y + 2
          const width = 40
          const height = 15

          doc.addImage(imgData, 'PNG', x, y, width, height)
        }
      }
    })

    doc.save("etiquetas_inventario_escaneable.pdf")
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-end mb-3 gap-2">
        <CButton color="dark" className="text-white" onClick={exportPrintablePDF}>
          <CIcon icon={cilPrint} className="me-1" /> Imprimir Códigos
        </CButton>
        {/* Solo el admin ve el botón de añadir bolso */}
        {isAdmin && (
          <CButton color="primary" onClick={handleOpenAddModal}>
            <CIcon icon={cilPlus} /> Añadir Bolso
          </CButton>
        )}
      </div>

      <CCard>
        <CCardBody>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-2 mb-3">
            <CFormInput
              type="search"
              placeholder="Buscar por nombre o código de barras"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-100"
            />
            <CFormSelect
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="w-100"
            >
              <option value="none">Orden predeterminado</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="stock-desc">Stock: mayor a menor</option>
              <option value="stock-asc">Stock: menor a mayor</option>
            </CFormSelect>
          </div>
          <CTable striped hover responsive align="middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Imagen</CTableHeaderCell>
                <CTableHeaderCell>Modelo</CTableHeaderCell>
                <CTableHeaderCell>Costo</CTableHeaderCell>
                <CTableHeaderCell>Precio Venta</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Stock Total</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Almacén</CTableHeaderCell>
                <CTableHeaderCell className="text-center">Pendiente</CTableHeaderCell>
                <CTableHeaderCell>Acciones</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {displayedBags.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={8} className="text-center text-muted py-4">
                    No se encontraron bolsos para esta búsqueda.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                displayedBags.map((bag) => (
                  <CTableRow key={bag.bag_id}>
                    <CTableDataCell>
                      <img src={bag.image_url} alt={bag.model_name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }} />
                    </CTableDataCell>
                    <CTableDataCell className="fw-bold">{bag.model_name}</CTableDataCell>
                    <CTableDataCell>COP {bag.investment_cost}</CTableDataCell>
                    <CTableDataCell>COP {bag.sale_price}</CTableDataCell>
                    <CTableDataCell className="text-center"><CBadge color="primary">{bag.total_stock}</CBadge></CTableDataCell>
                    <CTableDataCell className="text-center"><CBadge color="success">{bag.warehouse_stock}</CBadge></CTableDataCell>
                    <CTableDataCell className="text-center"><CBadge color="warning">{bag.consigned_stock}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex">
                        {/* El botón de información lo ven todos */}
                        <CButton color="info" size="sm" className="me-2" onClick={() => handleView(bag)}>
                          <CIcon icon={cilInfo} className="text-white" />
                        </CButton>
                        {/* Los botones de Editar y Eliminar solo los ve el admin */}
                        {isAdmin && (
                          <>
                            <CButton color="primary" size="sm" className="me-2" onClick={() => handleEdit(bag)}>
                              <CIcon icon={cilPencil} className="text-white" />
                            </CButton>
                            <CButton color="danger" size="sm" onClick={() => handleDelete(bag)}>
                              <CIcon icon={cilTrash} className="text-white" />
                            </CButton>
                          </>
                        )}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="text-muted">Mostrando {displayedBags.length} de {filteredBags.length} bolsos</div>
            <div className="d-flex align-items-center gap-2">
              <CButton
                type="button"
                color="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </CButton>
              <span>Página {currentPage} de {totalPages}</span>
              <CButton
                type="button"
                color="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>

      {/* --- MODAL ESCANEO ACTIVO --- */}
      <CModal visible={scanModal} onClose={() => setScanModal(false)}>
        <CModalHeader onClose={() => setScanModal(false)} className="bg-success text-white">
          <CModalTitle>¡Bolso Escaneado!</CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          {selectedBag && (
            <div>
              <img src={selectedBag.image_url} alt={selectedBag.model_name} style={{ width: '120px', borderRadius: '8px', marginBottom: '10px' }} />
              <h4 className="mb-0">{selectedBag.model_name}</h4>
              <p className="text-muted">{selectedBag.code_bar}</p>
              
              <div className="d-flex justify-content-around my-3 p-3 bg-light rounded">
                <div>
                  <div className="small text-muted">Stock Almacén</div>
                  <div className="fs-5 fw-bold text-success">{selectedBag.warehouse_stock}</div>
                </div>
                <div>
                  <div className="small text-muted">Stock Total</div>
                  <div className="fs-5 fw-bold">{selectedBag.total_stock}</div>
                </div>
              </div>

              <CFormInput 
                type="number" 
                label="¿Cuántas unidades nuevas ingresan al almacén?" 
                value={addUnitsAmount}
                onChange={(e) => setAddUnitsAmount(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton type="button" color="success" className="text-white" onClick={handleAddUnitsToScannedBag}>
            Añadir al Inventario
          </CButton>
          <CButton type="button" color="secondary" onClick={() => setScanModal(false)}>Cancelar</CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL VER Y UBICACIÓN EN TIENDAS --- */}
      <CModal visible={viewModal} onClose={() => setViewModal(false)} size="lg">
        <CModalHeader onClose={() => setViewModal(false)}>
          <CModalTitle>Detalle del Bolso y Ubicación en Tiendas</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedBag && (
            <div>
              <div className="row mb-4">
                <div className="col-md-4 text-center">
                  <img src={selectedBag.image_url} alt={selectedBag.model_name} style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                </div>
                <div className="col-md-8">
                  <h5>{selectedBag.model_name}</h5>
                  <p className="mb-1"><strong>Código de Barras:</strong> {selectedBag.code_bar}</p>
                  <p className="mb-1"><strong>Costo Inversión:</strong> COP {selectedBag.investment_cost}</p>
                  <p className="mb-1"><strong>Precio Venta:</strong> COP {selectedBag.sale_price}</p>
                  <div className="d-flex gap-2 mt-2">
                    <CBadge color="primary">Total: {selectedBag.total_stock}</CBadge>
                    <CBadge color="success">Almacén: {selectedBag.warehouse_stock}</CBadge>
                    <CBadge color="warning">Pendientes: {selectedBag.consigned_stock}</CBadge>
                  </div>
                </div>
              </div>

              <hr />

              <h6 className="fw-bold mb-3">Ubicación en Tiendas</h6>
              
              {isLoadingConsignments ? (
                <div className="text-center py-3">
                  <CSpinner color="primary" size="sm" /> Cargando información de tiendas...
                </div>
              ) : (() => {
                const pendingConsignments = consignmentDetails.filter((detail) => {
                  const invoices = detail.delivery_notes?.invoices || []
                  const paymentStatus = invoices[0]?.payment_status
                  return !paymentStatus || paymentStatus === 'pending'
                })

                if (pendingConsignments.length === 0) {
                  return (
                    <div className="alert alert-secondary text-center">
                      No hay consignaciones pendientes ni sin facturar para este bolso.
                    </div>
                  )
                }

                return (
                  <CTable striped hover responsive size="sm" align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Cód. Cliente</CTableHeaderCell>
                        <CTableHeaderCell>Centro Comercial</CTableHeaderCell>
                        <CTableHeaderCell>Fecha Entrega</CTableHeaderCell>
                        <CTableHeaderCell className="text-center">Entregados</CTableHeaderCell>
                        <CTableHeaderCell className="text-center">Vendidos</CTableHeaderCell>
                        <CTableHeaderCell className="text-center">Devueltos</CTableHeaderCell>
                        <CTableHeaderCell className="text-center">Estado Pago</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {pendingConsignments.map((detail) => {
                        const store = detail.delivery_notes?.stores
                        const customerCode = store?.code_customer || 'N/A'
                        const mallName = store?.malls?.name || 'N/A'

                        const invoices = detail.delivery_notes?.invoices || []
                        const paymentStatus = invoices[0]?.payment_status || 'Pago pendiente'

                        return (
                          <CTableRow key={detail.detail_id}>
                            <CTableDataCell className="fw-bold">{customerCode}</CTableDataCell>
                            <CTableDataCell>{mallName}</CTableDataCell>
                            <CTableDataCell>{detail.delivery_notes?.date_delivery || 'N/A'}</CTableDataCell>
                            <CTableDataCell className="text-center">{detail.delivered_quantity}</CTableDataCell>
                            <CTableDataCell className="text-center">{detail.sold_quantity || 0}</CTableDataCell>
                            <CTableDataCell className="text-center">{detail.returned_quantity || 0}</CTableDataCell>
                            <CTableDataCell className="text-center">
                              <CBadge color={paymentStatus === 'pending' ? 'warning' : 'secondary'}>
                                {paymentStatus}
                              </CBadge>
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })}
                    </CTableBody>
                  </CTable>
                )
              })()}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton type="button" color="secondary" onClick={() => setViewModal(false)}>Cerrar</CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL AÑADIR --- */}
      {isAdmin && (
        <CModal visible={addModal} onClose={() => setAddModal(false)}>
          <CModalHeader onClose={() => setAddModal(false)}>
            <CModalTitle>Añadir Nuevo Bolso</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CFormInput label="Código de Barras" value={newBag.code_bar} readOnly className="mb-2 bg-light" />
              <CFormInput label="Nombre del Modelo" name="model_name" value={newBag.model_name} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.model_name)} />
              {formErrors.model_name && <div className="text-danger small mb-2">{formErrors.model_name}</div>}
              <div className="d-flex gap-2 mb-2">
                <CFormInput type="number" label="Costo Inversión (COP)" name="investment_cost" value={newBag.investment_cost} onChange={handleInputChange} invalid={Boolean(formErrors.investment_cost)} />
                <CFormInput type="number" label="Precio Venta (COP)" name="sale_price" value={newBag.sale_price} onChange={handleInputChange} invalid={Boolean(formErrors.sale_price)} />
              </div>
              {formErrors.investment_cost && <div className="text-danger small mb-2">{formErrors.investment_cost}</div>}
              {formErrors.sale_price && <div className="text-danger small mb-2">{formErrors.sale_price}</div>}
              <CFormInput type="number" label="Stock Total" name="total_stock" value={newBag.total_stock} onChange={handleInputChange} className="mb-2" invalid={Boolean(formErrors.total_stock)} />
              {formErrors.total_stock && <div className="text-danger small mb-2">{formErrors.total_stock}</div>}
              <CFormInput type="file" label="Imagen del Bolso" accept="image/*" onChange={handleFileChange} className="mb-2" />
              {imagePreview && (
                <div className="mb-3 text-center">
                  <img src={imagePreview} alt="Vista previa" className="img-fluid rounded" style={{ maxHeight: '180px' }} />
                </div>
              )}
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton type="button" color="primary" onClick={handleAddBag} disabled={isUploading || isSubmitting}>
              {isSubmitting || isUploading ? 'Guardando...' : 'Guardar'}
            </CButton>
            <CButton type="button" color="secondary" onClick={() => setAddModal(false)} disabled={isSubmitting || isUploading}>Cancelar</CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* --- MODAL EDITAR --- */}
      {isAdmin && (
        <CModal visible={editModal} onClose={() => setEditModal(false)}>
          <CModalHeader onClose={() => setEditModal(false)}>
            <CModalTitle>Editar Bolso</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {bagToEdit && (
              <CForm>
                <CFormInput label="Nombre del Modelo" value={bagToEdit.model_name} onChange={(e) => setBagToEdit({ ...bagToEdit, model_name: e.target.value })} className="mb-2" invalid={Boolean(formErrors.model_name)} />
                {formErrors.model_name && <div className="text-danger small mb-2">{formErrors.model_name}</div>}
                <div className="d-flex gap-2 mb-2">
                  <CFormInput type="number" label="Costo Inversión (COP)" value={bagToEdit.investment_cost} onChange={(e) => setBagToEdit({ ...bagToEdit, investment_cost: e.target.value })} invalid={Boolean(formErrors.investment_cost)} />
                  <CFormInput type="number" label="Precio Venta (COP)" value={bagToEdit.sale_price} onChange={(e) => setBagToEdit({ ...bagToEdit, sale_price: e.target.value })} invalid={Boolean(formErrors.sale_price)} />
                </div>
                {formErrors.investment_cost && <div className="text-danger small mb-2">{formErrors.investment_cost}</div>}
                {formErrors.sale_price && <div className="text-danger small mb-2">{formErrors.sale_price}</div>}
                <CFormInput type="number" label="Stock Total" value={bagToEdit.total_stock} onChange={(e) => setBagToEdit({ ...bagToEdit, total_stock: e.target.value })} className="mb-2" invalid={Boolean(formErrors.total_stock)} />
                {formErrors.total_stock && <div className="text-danger small mb-2">{formErrors.total_stock}</div>}
              </CForm>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton type="button" color="primary" onClick={handleSaveEdit}>Guardar Cambios</CButton>
            <CButton type="button" color="secondary" onClick={() => setEditModal(false)}>Cancelar</CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* --- MODAL ELIMINAR --- */}
      {isAdmin && (
        <CModal visible={deleteModal} onClose={() => setDeleteModal(false)}>
          <CModalHeader onClose={() => setDeleteModal(false)}>
            <CModalTitle>Confirmar Eliminación</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {bagToDelete && (
              <p>¿Estás seguro de eliminar <strong>{bagToDelete.model_name}</strong> del inventario?</p>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton type="button" color="danger" onClick={confirmDelete}>Eliminar</CButton>
            <CButton type="button" color="secondary" onClick={() => setDeleteModal(false)}>Cancelar</CButton>
          </CModalFooter>
        </CModal>
      )}

      {alertData && (
        <AlertMessage response={alertData.response} type={alertData.type} onClose={() => setAlertData(null)} />
      )}
    </div>
  )
}

export default Inventory
