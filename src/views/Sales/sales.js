import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../config/supabaseClient'
import {
  CCard,
  CCardBody,
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPanel,
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
  CFormTextarea,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPlus,
  cilCheckCircle,
  cilMoney,
  cilTrash,
  cilInfo,
  cilFilter,
  cilCloudDownload,
} from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'

// Importaciones para generar PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const Sales = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-implantacion.onrender.com'

  const getLocalDateTimeValue = (date = new Date()) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return localDate.toISOString().slice(0, 16)
  }

  // Estados principales
  const [activeTab, setActiveTab] = useState(1)
  const [deliveries, setDeliveries] = useState([])
  const [malls, setMalls] = useState([])
  const [stores, setStores] = useState([])
  const [bags, setBags] = useState([])
  const [expenses, setExpenses] = useState([])
  const [alertData, setAlertData] = useState(null)

  // NUEVOS ESTADOS: Filtro
  const [filterPending, setFilterPending] = useState(false)
  const [filterDate, setFilterDate] = useState('') 

  const getMaxDate = () => {
    const now = new Date()
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return localDate.toISOString().split('T')[0]
  }

  // Lector de código de barras
  const [barcodeInput, setBarcodeInput] = useState('')
  const barcodeBufferRef = useRef('')

  // Modales
  const [addDeliveryModal, setAddDeliveryModal] = useState(false)
  const [settleModal, setSettleModal] = useState(false)
  const [expenseModal, setExpenseModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)

  // Datos seleccionados para Liquidación / Ver detalles
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [deliveryDetails, setDeliveryDetails] = useState([])
  const [invoiceHistory, setInvoiceHistory] = useState([])
  const [settlementData, setSettlementData] = useState({})
  
  // ESTADOS DE PAGO
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [amountCash, setAmountCash] = useState('')       // NUEVO: Monto en efectivo (para pago mixto)
  const [amountTransfer, setAmountTransfer] = useState('') // NUEVO: Monto en transferencia (para pago mixto)
  const [paymentDate, setPaymentDate] = useState(() => getLocalDateTimeValue())
  const [paymentNotes, setPaymentNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Formulario nueva Nota de Entrega
  const [newDeliveryMall, setNewDeliveryMall] = useState('')
  const [newDeliveryStore, setNewDeliveryStore] = useState('')
  const [deliveryItems, setDeliveryItems] = useState([])

  // Formulario nuevo Gasto (`expenses`)
  const [newExpense, setNewExpense] = useState({ amount: '', description: '' })
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const itemsPerPage = 10

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'Bank_Transfer':
        return 'Transferencia Bancaria'
      case 'mix':
        return 'Mixto (Efectivo y Transferencia)' // NUEVO
      case 'Cash':
      default:
        return 'Efectivo'
    }
  }

  // APLICACIÓN DEL FILTRO DE PENDIENTES Y FECHA
  const filteredDeliveries = deliveries.filter((del) => {
    // 1. Filtro de pendientes
    const matchesPending = filterPending 
      ? (!del.invoices || del.invoices.length === 0) 
      : true;

    // 2. Filtro por fecha (formato YYYY-MM-DD)
    let matchesDate = true;
    if (filterDate && del.date_delivery) {
      const d = new Date(del.date_delivery);
      // Convertimos la fecha de la base de datos al formato local YYYY-MM-DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const formattedDeliveryDate = `${year}-${month}-${day}`;

      matchesDate = formattedDeliveryDate === filterDate;
    }

    return matchesPending && matchesDate;
  })

  const deliveryTotalPages = Math.max(1, Math.ceil(filteredDeliveries.length / itemsPerPage))
  const expenseTotalPages = Math.max(1, Math.ceil(expenses.length / itemsPerPage))

  const paginatedDeliveries = filteredDeliveries.slice(
    (deliveryPage - 1) * itemsPerPage,
    deliveryPage * itemsPerPage,
  )
  const paginatedExpenses = expenses.slice(
    (expensePage - 1) * itemsPerPage,
    expensePage * itemsPerPage,
  )

  // Carga de datos iniciales
  const fetchDeliveries = async () => {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(
        '*, stores(code_customer, number_store, id_mall), users(first_name, last_name), invoices(*)',
      )
      .order('delivery_id', { ascending: false })

    if (error) setAlertData({ response: { message: error.message }, type: 'danger' })
    else setDeliveries(data || [])
  }

  const fetchMalls = async () => {
    const { data } = await supabase.from('malls').select('*')
    setMalls(data || [])
  }

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('*')
    setStores(data || [])
  }

  const fetchBags = async () => {
    const { data } = await supabase.from('bags').select('*').eq('status', 'active')
    setBags(data || [])
  }

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, users(first_name, last_name)')
      .order('expense_id', { ascending: false })

    if (error) setAlertData({ response: { message: error.message }, type: 'danger' })
    else setExpenses(data || [])
  }

  useEffect(() => {
    fetchDeliveries()
    fetchMalls()
    fetchStores()
    fetchBags()
    fetchExpenses()
  }, [])

  useEffect(() => {
    setDeliveryPage(1)
  }, [filteredDeliveries.length])

  useEffect(() => {
    setExpensePage(1)
  }, [expenses.length])

  const uploadReceiptToBackend = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Fallo al subir el comprobante de pago')
    }

    const data = await response.json()
    return data.url
  }

  const processBarcodeScan = (scannedCode) => {
    const trimmedCode = scannedCode?.trim()
    if (!trimmedCode) return

    const foundBag = bags.find(
      (bag) =>
        String(bag.code_bar || '')
          .trim()
          .toLowerCase() === trimmedCode.toLowerCase(),
    )

    if (foundBag) {
      setDeliveryItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex(
          (item) => Number(item.bag_id) === foundBag.bag_id,
        )
        const currentQtyInCart =
          existingItemIndex >= 0 ? Number(prevItems[existingItemIndex].quantity || 0) : 0

        if (currentQtyInCart + 1 > foundBag.warehouse_stock) {
          setAlertData({
            response: {
              message: `Stock insuficiente en almacén para ${foundBag.model_name}. Disponibles: ${foundBag.warehouse_stock}`,
            },
            type: 'danger',
          })
          return prevItems
        }

        if (existingItemIndex >= 0) {
          const updated = [...prevItems]
          updated[existingItemIndex].quantity = currentQtyInCart + 1
          return updated
        }

        return [...prevItems, { bag_id: foundBag.bag_id, quantity: 1 }]
      })
    } else {
      setAlertData({
        response: { message: `No se encontró ningún bolso con el código: ${trimmedCode}` },
        type: 'warning',
      })
    }

    barcodeBufferRef.current = ''
    setBarcodeInput('')
  }

  useEffect(() => {
    if (!addDeliveryModal) {
      barcodeBufferRef.current = ''
      setBarcodeInput('')
      return
    }

    const handleGlobalBarcodeKeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        processBarcodeScan(barcodeBufferRef.current)
        return
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const nextValue = `${barcodeBufferRef.current}${event.key}`
        barcodeBufferRef.current = nextValue
        setBarcodeInput(nextValue)
      }
    }

    window.addEventListener('keydown', handleGlobalBarcodeKeydown)
    return () => window.removeEventListener('keydown', handleGlobalBarcodeKeydown)
  }, [addDeliveryModal, bags])

  const handleAddItemToDelivery = () => {
    setDeliveryItems([...deliveryItems, { bag_id: '', quantity: '' }])
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...deliveryItems]
    updated[index][field] = value
    setDeliveryItems(updated)
  }

  const handleRemoveItem = (index) => {
    setDeliveryItems(deliveryItems.filter((_, i) => i !== index))
  }

  const handleCreateDeliveryNote = async () => {
    if (!newDeliveryStore) {
      setAlertData({
        response: { message: 'Debe seleccionar un local registrado' },
        type: 'warning',
      })
      return
    }
    if (deliveryItems.length === 0) {
      setAlertData({ response: { message: 'Debe agregar al menos un bolso' }, type: 'warning' })
      return
    }

    for (const item of deliveryItems) {
      const bag = bags.find((b) => b.bag_id === Number(item.bag_id))
      const qty = Number(item.quantity)
      if (!bag || qty <= 0) {
        setAlertData({
          response: { message: 'Seleccione un producto y cantidad válidos' },
          type: 'warning',
        })
        return
      }
      if (qty > bag.warehouse_stock) {
        setAlertData({
          response: {
            message: `Stock insuficiente en almacén para ${bag.model_name}. Disponibles: ${bag.warehouse_stock}`,
          },
          type: 'danger',
        })
        return
      }
    }

    setIsUploading(true)
    try {
      const storedUser = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}')
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        setAlertData({ response: { message: 'Error de sesión. Vuelve a iniciar sesión.' }, type: 'danger' })
        setIsUploading(false)
        return
      }

      const { data: deliveryNote, error: noteError } = await supabase
        .from('delivery_notes')
        .insert([
          {
            id_store: Number(newDeliveryStore),
            id_user: internalUserId,
            date_delivery: getLocalDateTimeValue(),
          },
        ])
        .select()
        .single()

      if (noteError) throw noteError

      for (const item of deliveryItems) {
        const bagId = Number(item.bag_id)
        const qty = Number(item.quantity)
        const bag = bags.find((b) => b.bag_id === bagId)

        await supabase.from('delivery_details').insert([
          {
            delivery_id: deliveryNote.delivery_id,
            bag_id: bagId,
            delivered_quantity: qty,
            sold_quantity: 0,
            returned_quantity: 0,
          },
        ])

        await supabase
          .from('bags')
          .update({
            warehouse_stock: bag.warehouse_stock - qty,
            consigned_stock: bag.consigned_stock + qty,
          })
          .eq('bag_id', bagId)
      }

      setAddDeliveryModal(false)
      setNewDeliveryMall('')
      setNewDeliveryStore('')
      setDeliveryItems([])
      fetchDeliveries()
      fetchBags()
      setAlertData({
        response: { message: 'Nota de entrega creada y stock actualizado' },
        type: 'success',
      })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsUploading(false)
    }
  }

  const openSettleModal = async (delivery) => {
    setSelectedDelivery(delivery)

    const [{ data: detailsData }, { data: invoicesData }] = await Promise.all([
      supabase
        .from('delivery_details')
        .select(
          '*, bags(model_name, sale_price, investment_cost, consigned_stock, warehouse_stock, total_stock)',
        )
        .eq('delivery_id', delivery.delivery_id),
      supabase
        .from('invoices')
        .select('*')
        .eq('delivery_id', delivery.delivery_id)
        .order('date_billing', { ascending: false }),
    ])

    setDeliveryDetails(detailsData || [])
    setInvoiceHistory(invoicesData || [])

    const initialSettlement = {}
    detailsData?.forEach((det) => {
      initialSettlement[det.detail_id] = {
        sold: '',
        returned: '',
        bag_id: det.bag_id,
        delivered: det.delivered_quantity,
      }
    })
    setSettlementData(initialSettlement)
    setPaymentMethod('Cash')
    
    // Limpiamos montos previos
    setAmountCash('')
    setAmountTransfer('')
    
    setPaymentDate(getLocalDateTimeValue())
    setPaymentNotes('')
    setReceiptFile(null)
    setSettleModal(true)
  }

  const handleSettlementChange = (detailId, field, value) => {
    setSettlementData({
      ...settlementData,
      [detailId]: { ...settlementData[detailId], [field]: value },
    })
  }

  // --- CÁLCULO EN TIEMPO REAL PARA EL MODAL DE LIQUIDACIÓN ---
  const calculatedTotal = deliveryDetails.reduce((sum, det) => {
    const sold = Number(settlementData[det.detail_id]?.sold) || 0
    return sum + (sold * Number(det.bags?.sale_price || 0))
  }, 0)

  const handleConfirmSettlement = async () => {
    if (invoiceHistory.length > 0) {
      setAlertData({
        response: {
          message:
            'Esta entrega ya tiene facturas registradas. Revise el historial para ver los detalles.',
        },
        type: 'warning',
      })
      return
    }

    // 1. CALCULAMOS EL MONTO TOTAL Y VALIDAMOS CANTIDADES PRIMERO
    let amountTotal = 0
    for (const [detailId, info] of Object.entries(settlementData)) {
      const sold = Number(info.sold) || 0
      const returned = Number(info.returned) || 0
      if (sold + returned > info.delivered) {
        setAlertData({
          response: {
            message: 'La suma de vendidos y devueltos no puede superar la cantidad entregada',
          },
          type: 'danger',
        })
        return
      }
      // Sumamos al total usando el precio del detalle correspondiente
      const det = deliveryDetails.find((d) => d.detail_id === Number(detailId))
      amountTotal += sold * Number(det.bags.sale_price)
    }

    // 2. VALIDAMOS QUE LOS MONTOS DE PAGO MIXTO CUADREN EXACTAMENTE
    if (paymentMethod === 'mix') {
      const cashVal = Number(amountCash) || 0
      const transVal = Number(amountTransfer) || 0
      if (cashVal + transVal !== amountTotal) {
        setAlertData({
          response: { 
            message: `Los montos no cuadran. El total a pagar es $${amountTotal}, pero la suma de Efectivo ($${cashVal}) y Transferencia ($${transVal}) da un total de $${cashVal + transVal}.` 
          },
          type: 'danger',
        })
        return
      }
    }

    // 3. VALIDAMOS QUE EXISTA RECIBO SI HAY TRANSFERENCIA DE POR MEDIO Y EL MONTO ES MAYOR A 0
    if ((paymentMethod === 'Bank_Transfer' || paymentMethod === 'mix') && !receiptFile && amountTotal > 0) {
      setAlertData({
        response: { message: 'Debe subir el comprobante de pago de la transferencia' },
        type: 'warning',
      })
      return
    }

    setIsUploading(true)
    try {
      let receiptUrl = null
      if ((paymentMethod === 'Bank_Transfer' || paymentMethod === 'mix') && receiptFile) {
        receiptUrl = await uploadReceiptToBackend(receiptFile)
      }

      const storedUser = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}')
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        setAlertData({ response: { message: 'Error de sesión. Vuelve a iniciar sesión.' }, type: 'danger' })
        setIsUploading(false)
        return
      }

      const isReturned = amountTotal === 0
      const finalPaymentStatus = isReturned ? 'returned' : 'paid'

      // Preparamos los montos divididos según la elección
      let finalAmountCash = 0
      let finalAmountTransfer = 0

      if (paymentMethod === 'Cash') {
        finalAmountCash = amountTotal
      } else if (paymentMethod === 'Bank_Transfer') {
        finalAmountTransfer = amountTotal
      } else if (paymentMethod === 'mix') {
        finalAmountCash = Number(amountCash) || 0
        finalAmountTransfer = Number(amountTransfer) || 0
      }

      const invoicePayload = {
        delivery_id: selectedDelivery.delivery_id,
        id_user: internalUserId,
        date_billing: getLocalDateTimeValue(),
        amount_total: amountTotal,
        amount_cash: finalAmountCash,          // NUEVO
        amount_transfer: finalAmountTransfer,  // NUEVO
        payment_method: paymentMethod,
        payment_receipt_url: receiptUrl,
        payment_status: finalPaymentStatus,
        payment_date: paymentDate || getLocalDateTimeValue(),
        notes:
          paymentNotes.trim() ||
          `Liquidación #${selectedDelivery.delivery_id} - ${isReturned ? 'Devolución total de mercancía' : getPaymentMethodLabel(paymentMethod)}`,
      }

      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single()

      if (invoiceError) {
        // Fallback en caso de que las columnas opcionales arrojen error (protección extra)
        const fallbackPayload = { ...invoicePayload }
        delete fallbackPayload.payment_status
        delete fallbackPayload.payment_date
        delete fallbackPayload.notes

        const { data: fallbackInvoice, error: fallbackError } = await supabase
          .from('invoices')
          .insert([fallbackPayload])
          .select()
          .single()

        if (fallbackError) throw fallbackError
        setInvoiceHistory([fallbackInvoice])
      } else {
        setInvoiceHistory([createdInvoice])
      }

      for (const [detailId, info] of Object.entries(settlementData)) {
        const sold = Number(info.sold) || 0
        const returned = Number(info.returned) || 0
        const det = deliveryDetails.find((d) => d.detail_id === Number(detailId))

        await supabase
          .from('delivery_details')
          .update({
            sold_quantity: sold,
            returned_quantity: returned,
          })
          .eq('detail_id', Number(detailId))

        const bag = bags.find((b) => b.bag_id === det.bag_id)
        await supabase
          .from('bags')
          .update({
            total_stock: bag.total_stock - sold,
            consigned_stock: bag.consigned_stock - (sold + returned),
            warehouse_stock: bag.warehouse_stock + returned,
          })
          .eq('bag_id', det.bag_id)
      }

      setSettleModal(false)
      fetchDeliveries()
      fetchBags()
      setAlertData({
        response: { message: 'Liquidación procesada y factura generada con éxito' },
        type: 'success',
      })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveExpense = async () => {
    if (!newExpense.amount || !newExpense.description) {
      setAlertData({ response: { message: 'Complete los campos del gasto' }, type: 'warning' })
      return
    }

    try {
      const storedUser = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}')
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        setAlertData({ response: { message: 'Error de sesión. Vuelve a iniciar sesión.' }, type: 'danger' })
        return
      }

      const { error } = await supabase.from('expenses').insert([
        {
          id_user: internalUserId,
          amount: Number(newExpense.amount),
          description: newExpense.description,
          expense_date: getLocalDateTimeValue(),
        },
      ])

      if (error) throw error

      setExpenseModal(false)
      setNewExpense({ amount: '', description: '' })
      fetchExpenses()
      setAlertData({ response: { message: 'Gasto registrado correctamente' }, type: 'success' })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  // GENERAR PDF DE REPORTE (DIARIO/SEMANAL DESGLOSADO)
  const downloadReportPDF = () => {
    const doc = new jsPDF()
    const now = new Date()
    const isSaturday = now.getDay() === 6
    const startDate = new Date(now)

    if (isSaturday) {
      // Si es sábado, obtenemos la ventana de los últimos 6 días (+ hoy = 7 días)
      startDate.setDate(now.getDate() - 6)
    }
    startDate.setHours(0, 0, 0, 0)

    // 1. Inicializar objeto para agrupar por días
    const dailyData = {}
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString()
      dailyData[dateStr] = { paid: 0, pending: 0, returned: 0, totalSales: 0 }
    }

    // 2. Procesar las notas de entrega y mapearlas a sus respectivos días
    deliveries.forEach((del) => {
      const delDate = new Date(del.date_delivery)
      if (delDate >= startDate && delDate <= now) {
        const dateStr = delDate.toLocaleDateString()
        if (dailyData[dateStr]) {
          const latestInvoice = del.invoices && del.invoices.length > 0 ? del.invoices[0] : null

          if (!latestInvoice) {
            dailyData[dateStr].pending++
          } else {
            if (latestInvoice.payment_status === 'paid') {
              dailyData[dateStr].paid++
              dailyData[dateStr].totalSales += Number(latestInvoice.amount_total) || 0
            } else if (latestInvoice.payment_status === 'returned') {
              dailyData[dateStr].returned++
            }
          }
        }
      }
    })

    // 3. Formatear datos para autoTable de jsPDF
    const tableColumn = ['Fecha', 'Entregas Pagadas', 'Pendientes', 'Devueltas', 'Ingresos (COP)']
    const tableRows = []
    let grandTotal = 0
    let totalPending = 0
    let totalPaid = 0
    let totalReturned = 0

    Object.keys(dailyData).forEach((date) => {
      const day = dailyData[date]
      const rowData = [
        date,
        day.paid.toString(),
        day.pending.toString(),
        day.returned.toString(),
        `$${day.totalSales.toFixed(2)}`,
      ]
      tableRows.push(rowData)

      grandTotal += day.totalSales
      totalPaid += day.paid
      totalPending += day.pending
      totalReturned += day.returned
    })

    // 4. Dibujar el Documento PDF
    doc.setFontSize(18)
    doc.text(`Reporte ${isSaturday ? 'Semanal' : 'Diario'} de Ventas`, 14, 22)

    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(
      `Periodo evaluado: ${startDate.toLocaleDateString()} al ${now.toLocaleDateString()}`,
      14,
      30,
    )

    // Tabla principal
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      foot: [
        [
          'Totales',
          totalPaid.toString(),
          totalPending.toString(),
          totalReturned.toString(),
          `$${grandTotal.toFixed(2)}`,
        ],
      ],
      footStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    })

    // Descargar Archivo
    doc.save(`Reporte_${isSaturday ? 'Semanal' : 'Diario'}_Ventas.pdf`)
  }

  return (
    <div className="p-3">
      <CTabs activeItem={activeTab} onActiveItemChange={(idx) => setActiveTab(idx)}>
        <CTabList variant="underline" className="mb-3">
          <CTab item={1} onClick={() => setActiveTab(1)}>
            Notas de Entrega / Ventas
          </CTab>
          <CTab item={2} onClick={() => setActiveTab(2)}>
            Gastos Operativos
          </CTab>
        </CTabList>
        <CTabContent>
          {/* TAB 1: NOTAS DE ENTREGA */}
          <CTabPanel item={1} className={activeTab === 1 ? 'd-block' : 'd-none'}>
            <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
              <div className="d-flex gap-2 align-items-center flex-wrap">
                
                {/* --- INPUT DE FECHA CON LÍMITE HASTA HOY --- */}
                <CFormInput
                  type="date"
                  value={filterDate}
                  max={getMaxDate()}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="shadow-sm"
                  style={{ maxWidth: '160px' }}
                />
                {filterDate && (
                  <CButton color="secondary" variant="ghost" onClick={() => setFilterDate('')}>
                    Limpiar
                  </CButton>
                )}
                {/* ----------------------------- */}

                <CButton
                  color={filterPending ? 'secondary' : 'light'}
                  onClick={() => setFilterPending(!filterPending)}
                  className="shadow-sm text-nowrap"
                >
                  <CIcon icon={cilFilter} className="me-1" />
                  {filterPending ? 'Mostrando Pendientes' : 'Filtrar Pendientes'}
                </CButton>
                <CButton color="info" className="text-white shadow-sm text-nowrap" onClick={downloadReportPDF}>
                  <CIcon icon={cilCloudDownload} className="me-1" />
                  Descargar Reporte {new Date().getDay() === 6 ? 'Semanal' : 'Diario'}
                </CButton>
              </div>
              <CButton
                color="primary"
                onClick={() => setAddDeliveryModal(true)}
                className="shadow-sm text-nowrap"
              >
              <CIcon icon={cilPlus} className="me-1" /> Nuevo Pedido
              </CButton>
            </div>

            <CCard className="shadow-sm border-0">
              <CCardBody>
                <CTable striped hover responsive align="middle">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Centro Comercial</CTableHeaderCell>
                      <CTableHeaderCell>Local / Cliente</CTableHeaderCell>
                      <CTableHeaderCell>Empleado</CTableHeaderCell>
                      <CTableHeaderCell>Fecha Entrega</CTableHeaderCell>
                      <CTableHeaderCell>Acciones</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {paginatedDeliveries.map((del) => {
                      return (
                        <CTableRow key={del.delivery_id}>
                          <CTableDataCell>
                            {malls.find((m) => m.id_mall === del.stores?.id_mall)?.name || 'N/A'}
                          </CTableDataCell>
                          <CTableDataCell>
                            {del.stores?.code_customer} - Local {del.stores?.number_store}
                          </CTableDataCell>
                          <CTableDataCell>
                            {del.users?.first_name} {del.users?.last_name}
                          </CTableDataCell>
                          <CTableDataCell>
                            {new Date(del.date_delivery).toLocaleDateString()}
                          </CTableDataCell>
                          <CTableDataCell>
                            <div className="d-flex flex-column align-items-start gap-2">
                              {(() => {
                                const latestInvoice =
                                  del.invoices && del.invoices.length > 0 ? del.invoices[0] : null
                                const status = latestInvoice
                                  ? latestInvoice.payment_status
                                  : 'pending'

                                let badgeColor = 'warning'
                                let badgeText = 'Pendiente'

                                if (status === 'paid') {
                                  badgeColor = 'success'
                                  badgeText = 'Pagado'
                                } else if (status === 'returned') {
                                  badgeColor = 'dark'
                                  badgeText = 'Devuelto'
                                }

                                return <CBadge color={badgeColor}>{badgeText}</CBadge>
                              })()}
                              <CButton
                                color={del.invoices?.length ? 'info' : 'success'}
                                size="sm"
                                className={del.invoices?.length ? '' : 'text-white'}
                                onClick={() => openSettleModal(del)}
                              >
                                <CIcon icon={cilCheckCircle} className="me-1" />{' '}
                                {del.invoices?.length ? 'Ver historial' : 'Liquidar / Cobrar'}
                              </CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    Mostrando {paginatedDeliveries.length} de {filteredDeliveries.length} notas
                  </small>
                  <div className="d-flex gap-2">
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="outline"
                      onClick={() => setDeliveryPage((page) => Math.max(1, page - 1))}
                      disabled={deliveryPage === 1}
                    >
                      Anterior
                    </CButton>
                    {Array.from({ length: deliveryTotalPages }, (_, index) => index + 1).map(
                      (page) => (
                        <CButton
                          key={page}
                          size="sm"
                          color={page === deliveryPage ? 'primary' : 'light'}
                          onClick={() => setDeliveryPage(page)}
                        >
                          {page}
                        </CButton>
                      ),
                    )}
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="outline"
                      onClick={() =>
                        setDeliveryPage((page) => Math.min(deliveryTotalPages, page + 1))
                      }
                      disabled={deliveryPage === deliveryTotalPages}
                    >
                      Siguiente
                    </CButton>
                  </div>
                </div>
              </CCardBody>
            </CCard>
          </CTabPanel>

          {/* TAB 2: GASTOS */}
          <CTabPanel item={2} className={activeTab === 2 ? 'd-block' : 'd-none'}>
            <div className="d-flex justify-content-end mb-3">
              <CButton
                color="warning"
                className="text-white shadow-sm"
                onClick={() => setExpenseModal(true)}
              >
                <CIcon icon={cilMoney} className="me-1" /> Registrar Gasto
              </CButton>
            </div>

            <CCard className="shadow-sm border-0">
              <CCardBody>
                <CTable striped hover responsive align="middle">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Registrado por</CTableHeaderCell>
                      <CTableHeaderCell>Monto</CTableHeaderCell>
                      <CTableHeaderCell>Detalle</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {paginatedExpenses.map((exp) => (
                      <CTableRow key={exp.expense_id}>
                        <CTableDataCell>
                          {exp.users?.first_name} {exp.users?.last_name}
                        </CTableDataCell>
                        <CTableDataCell className="fw-bold text-danger">
                          ${exp.amount}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton
                            color="info"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedExpense(exp)
                              setViewModal(true)
                            }}
                          >
                            <CIcon icon={cilInfo} className="me-1" /> Ver descripción
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    Mostrando {paginatedExpenses.length} de {expenses.length} gastos
                  </small>
                  <div className="d-flex gap-2">
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="outline"
                      onClick={() => setExpensePage((page) => Math.max(1, page - 1))}
                      disabled={expensePage === 1}
                    >
                      Anterior
                    </CButton>
                    {Array.from({ length: expenseTotalPages }, (_, index) => index + 1).map(
                      (page) => (
                        <CButton
                          key={page}
                          size="sm"
                          color={page === expensePage ? 'primary' : 'light'}
                          onClick={() => setExpensePage(page)}
                        >
                          {page}
                        </CButton>
                      ),
                    )}
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="outline"
                      onClick={() =>
                        setExpensePage((page) => Math.min(expenseTotalPages, page + 1))
                      }
                      disabled={expensePage === expenseTotalPages}
                    >
                      Siguiente
                    </CButton>
                  </div>
                </div>
              </CCardBody>
            </CCard>
          </CTabPanel>
        </CTabContent>
      </CTabs>

      {/* --- MODAL CREAR NOTA DE ENTREGA --- */}
      <CModal visible={addDeliveryModal} onClose={() => setAddDeliveryModal(false)} size="lg">
        <CModalHeader onClose={() => setAddDeliveryModal(false)}>
          <CModalTitle>Crear Nota de Entrega (Consignación)</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormSelect
              label="Centro Comercial"
              value={newDeliveryMall}
              onChange={(e) => {
                setNewDeliveryMall(e.target.value)
                setNewDeliveryStore('')
              }}
              className="mb-3"
            >
              <option value="">Seleccione el Centro Comercial</option>
              {malls.map((m) => (
                <option key={m.id_mall} value={m.id_mall}>
                  {m.name}
                </option>
              ))}
            </CFormSelect>

            <CFormSelect
              label="Local Destino (Registrado)"
              value={newDeliveryStore}
              onChange={(e) => setNewDeliveryStore(e.target.value)}
              className="mb-3"
              disabled={!newDeliveryMall}
            >
              <option value="">Seleccione el Local</option>
              {stores
                .filter((st) => st.id_mall === Number(newDeliveryMall))
                .map((st) => (
                  <option key={st.id_store} value={st.id_store}>
                    {st.code_customer} - Local {st.number_store}
                  </option>
                ))}
            </CFormSelect>

            <div className="mb-4 p-3 bg-light border rounded">
              <CFormInput
                type="text"
                label="Escanear Código de Barras"
                placeholder="Pase el lector por el código..."
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value)
                  barcodeBufferRef.current = e.target.value
                }}
                autoFocus
              />
              <small className="text-muted">
                El artículo se agregará automáticamente al escanear.
              </small>
            </div>

            <h6 className="fw-bold">Artículos a entregar</h6>
            {deliveryItems.map((item, index) => (
              <div key={index} className="d-flex gap-2 align-items-end mb-2">
                <CFormSelect
                  label="Bolso"
                  value={item.bag_id}
                  onChange={(e) => handleItemChange(index, 'bag_id', e.target.value)}
                >
                  <option value="">Seleccione Bolso</option>
                  {bags.map((b) => (
                    <option key={b.bag_id} value={b.bag_id}>
                      {b.model_name} (Almacén: {b.warehouse_stock})
                    </option>
                  ))}
                </CFormSelect>
                <CFormInput
                  type="number"
                  label="Cantidad"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                />
                <CButton color="danger" size="sm" onClick={() => handleRemoveItem(index)}>
                  <CIcon icon={cilTrash} className="text-white" />
                </CButton>
              </div>
            ))}
            <CButton
              color="dark"
              size="sm"
              onClick={handleAddItemToDelivery}
              className="mt-2 text-white"
            >
              + Agregar otro artículo
            </CButton>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleCreateDeliveryNote} disabled={isUploading}>
            {isUploading ? 'Procesando...' : 'Guardar Pedido'}
          </CButton>
          <CButton color="secondary" onClick={() => setAddDeliveryModal(false)}>
            Cancelar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL LIQUIDACIÓN (Settlement) --- */}
      <CModal visible={settleModal} onClose={() => setSettleModal(false)} size="lg">
        <CModalHeader onClose={() => setSettleModal(false)} className="bg-success text-white">
          <CModalTitle>Liquidar Nota de Entrega</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedDelivery && (
            <div>
              <p className="text-muted">
                Procesando liquidación para entrega #{selectedDelivery.delivery_id}
              </p>

              {invoiceHistory.length > 0 && (
                <div className="mb-4 border rounded p-3 bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold mb-0">Historial de facturación</h6>
                    <CBadge color="success">Pagada</CBadge>
                  </div>
                  {invoiceHistory.map((invoice) => (
                    <div key={invoice.id_invoices} className="border rounded p-2 mb-2 bg-white">
                      <div className="d-flex justify-content-between align-items-center">
                        <strong>Factura #{invoice.id_invoices}</strong>
                        <CBadge
                          color={
                            invoice.payment_status === 'paid'
                              ? 'success'
                              : invoice.payment_status === 'partial'
                                ? 'warning'
                                : invoice.payment_status === 'returned'
                                  ? 'dark'
                                  : 'secondary'
                          }
                        >
                          {invoice.payment_status === 'returned'
                            ? 'Devuelto'
                            : invoice.payment_status || 'paid'}
                        </CBadge>
                      </div>
                      <div className="small text-muted mt-1">
                        <div>Total: ${invoice.amount_total}</div>
                        
                        {/* Mostrar desglose si es mix */}
                        {(Number(invoice.amount_cash) > 0 || Number(invoice.amount_transfer) > 0) ? (
                          <>
                            {Number(invoice.amount_cash) > 0 && <div>Efectivo: ${invoice.amount_cash}</div>}
                            {Number(invoice.amount_transfer) > 0 && <div>Transferencia: ${invoice.amount_transfer}</div>}
                          </>
                        ) : (
                           <div>Método: {getPaymentMethodLabel(invoice.payment_method)}</div>
                        )}

                        {invoice.payment_date && (
                          <div>Fecha: {new Date(invoice.payment_date).toLocaleString()}</div>
                        )}
                        {invoice.notes && <div className="mt-1">Nota: {invoice.notes}</div>}
                      </div>
                      {invoice.payment_receipt_url && (
                        <a
                          href={invoice.payment_receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="small mt-2 d-inline-block"
                        >
                          Ver comprobante
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {invoiceHistory.length > 0 ? (
                <div className="border rounded p-3 bg-light">
                  <p className="mb-2 text-muted">
                    Esta entrega ya fue liquidada y su historial se muestra solo para consulta.
                  </p>
                </div>
              ) : (
                <>
                  <CTable bordered align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Modelo</CTableHeaderCell>
                        <CTableHeaderCell>Entregado</CTableHeaderCell>
                        <CTableHeaderCell>Vendidos</CTableHeaderCell>
                        <CTableHeaderCell>Devueltos</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {deliveryDetails.map((det) => (
                        <CTableRow key={det.detail_id}>
                          <CTableDataCell>{det.bags?.model_name}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color="primary">{det.delivered_quantity}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput
                              type="number"
                              placeholder="0"
                              value={settlementData[det.detail_id]?.sold || ''}
                              onChange={(e) =>
                                handleSettlementChange(det.detail_id, 'sold', e.target.value)
                              }
                            />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput
                              type="number"
                              placeholder="0"
                              value={settlementData[det.detail_id]?.returned || ''}
                              onChange={(e) =>
                                handleSettlementChange(det.detail_id, 'returned', e.target.value)
                              }
                            />
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>

                  {/* INDICADOR VISUAL DEL TOTAL CALCULADO */}
                  <div className="mb-3 p-3 bg-light border border-info rounded text-info fw-bold text-center">
                    Total calculado a cobrar: ${calculatedTotal.toFixed(2)}
                  </div>

                  <CFormSelect
                    label="Método de Pago"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mb-3"
                  >
                    <option value="Cash">Efectivo</option>
                    <option value="Bank_Transfer">Transferencia Bancaria</option>
                    <option value="mix">Mixto (Efectivo y Transferencia)</option>
                  </CFormSelect>

                  {/* NUEVOS CAMPOS SI SELECCIONA mix */}
                  {paymentMethod === 'mix' && (
                    <div className="d-flex gap-2 mb-3">
                      <CFormInput
                        type="number"
                        label="Monto en Efectivo"
                        placeholder="Ej: 50"
                        value={amountCash}
                        onChange={(e) => setAmountCash(e.target.value)}
                      />
                      <CFormInput
                        type="number"
                        label="Monto en Transferencia"
                        placeholder="Ej: 50"
                        value={amountTransfer}
                        onChange={(e) => setAmountTransfer(e.target.value)}
                      />
                    </div>
                  )}

                  <CFormInput
                    type="datetime-local"
                    label="Fecha de pago"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mb-3"
                  />

                  <CFormTextarea
                    label="Nota del empleado"
                    rows={3}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Agregue una observación sobre el pago o la liquidación"
                    className="mb-3"
                  />

                  {/* EXIGIMOS IMAGEN SI HAY TRANSFERENCIA DE POR MEDIO */}
                  {(paymentMethod === 'Bank_Transfer' || paymentMethod === 'mix') && (
                    <CFormInput
                      type="file"
                      label="Comprobante de Pago (Transferencia)"
                      accept="image/*, application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files[0])}
                      className="mb-3"
                    />
                  )}
                </>
              )}

              <div className="mt-4 d-flex justify-content-end gap-2">
                <CButton
                  color="success"
                  className="text-white"
                  onClick={handleConfirmSettlement}
                  disabled={isUploading || invoiceHistory.length > 0}
                >
                  {isUploading
                    ? 'Facturando...'
                    : invoiceHistory.length > 0
                      ? 'Entrega ya liquidada'
                      : 'Confirmar Liquidación'}
                </CButton>
                <CButton color="secondary" onClick={() => setSettleModal(false)}>
                  Cancelar
                </CButton>
              </div>
            </div>
          )}
        </CModalBody>
      </CModal>

      {/* --- MODAL DETALLE DE GASTO --- */}
      <CModal visible={viewModal} onClose={() => setViewModal(false)}>
        <CModalHeader onClose={() => setViewModal(false)}>
          <CModalTitle>Detalle del gasto</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedExpense && (
            <div>
              <p className="mb-2">
                <strong>Registrado por:</strong> {selectedExpense.users?.first_name}{' '}
                {selectedExpense.users?.last_name}
              </p>
              <p className="mb-2">
                <strong>Monto:</strong> COP {selectedExpense.amount}
              </p>
              <p className="mb-2">
                <strong>Fecha:</strong> {new Date(selectedExpense.expense_date).toLocaleString()}
              </p>
              <div className="border rounded p-3 bg-light">
                <strong>Descripción:</strong>
                <p className="mb-0 mt-2">{selectedExpense.description}</p>
              </div>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setViewModal(false)}>
            Cerrar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL REGISTRAR GASTO --- */}
      <CModal visible={expenseModal} onClose={() => setExpenseModal(false)}>
        <CModalHeader onClose={() => setExpenseModal(false)}>
          <CModalTitle>Registrar Gasto Administrativo / Extra</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              type="number"
              label="Monto (COP)"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
              className="mb-2"
            />
            <CFormInput
              label="Descripción (Ej: Gasolina, estacionamiento)"
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              className="mb-2"
            />
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="warning" className="text-white" onClick={handleSaveExpense}>
            Guardar Gasto
          </CButton>
          <CButton color="secondary" onClick={() => setExpenseModal(false)}>
            Cancelar
          </CButton>
        </CModalFooter>
      </CModal>

      {alertData && (
        <AlertMessage
          response={alertData.response}
          type={alertData.type}
          onClose={() => setAlertData(null)}
        />
      )}
    </div>
  )
}

export default Sales