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
  CListGroup,
  CListGroupItem,
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

// Importación de Esquemas Zod
import {
  createDeliverySchema,
  settlementItemSchema,
  createExpenseSchema,
} from '../../schemas/sales.schema'

const Sales = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-implantacion.onrender.com'

  const getLocalDateTimeValue = (date = new Date()) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return localDate.toISOString().slice(0, 16)
  }

  // Estados principales
  const [activeTab, setActiveTab] = useState(1)
  const [deliveries, setDeliveries] = useState([])
  const [stores, setStores] = useState([])
  const [bags, setBags] = useState([])
  const [expenses, setExpenses] = useState([])
  const [alertData, setAlertData] = useState(null)

  // Estados de errores para cada formulario
  const [expenseErrors, setExpenseErrors] = useState({})
  const [deliveryErrors, setDeliveryErrors] = useState({})
  const [settlementErrors, setSettlementErrors] = useState({})

  // Función helper centralizada para manejar alertas
  const showAlert = (message, type = 'danger') => {
    setAlertData({ response: { message }, type })
  }

  // Función helper para obtener errores de validación (soporta arrays)
  const getValidationErrors = (schema, payload) => {
    try {
      schema.parse(payload)
      return {}
    } catch (error) {
      if (error?.issues) {
        return error.issues.reduce((acc, issue) => {
          const field = issue.path.join('.')
          acc[field] = issue.message
          return acc
        }, {})
      }
      return {}
    }
  }

  // Auto-cerrar alertas
  useEffect(() => {
    if (alertData) {
      const timer = setTimeout(() => {
        setAlertData(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [alertData])

  // Filtros
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
  const [amountCash, setAmountCash] = useState('')
  const [amountTransfer, setAmountTransfer] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => getLocalDateTimeValue())
  const [paymentNotes, setPaymentNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)

  const [selectedExpense, setSelectedExpense] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Formulario nueva Nota de Entrega
  const [newDeliveryStore, setNewDeliveryStore] = useState('')
  const [searchClientCode, setSearchClientCode] = useState('')
  const [foundStore, setFoundStore] = useState(null)
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
        return 'Mixto (Efectivo y Transferencia)'
      case 'Cash':
      default:
        return 'Efectivo'
    }
  }

  // APLICACIÓN DEL FILTRO DE PENDIENTES Y FECHA
  const filteredDeliveries = deliveries.filter((del) => {
    const matchesPending = filterPending
      ? !del.invoices || del.invoices.length === 0
      : true

    let matchesDate = true
    if (filterDate && del.date_delivery) {
      const d = new Date(del.date_delivery)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const formattedDeliveryDate = `${year}-${month}-${day}`

      matchesDate = formattedDeliveryDate === filterDate
    }

    return matchesPending && matchesDate
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
      .select('*, stores(code_customer, number_store), users(first_name, last_name), invoices(*)')
      .order('delivery_id', { ascending: false })

    if (error) showAlert(error.message, 'danger')
    else setDeliveries(data || [])
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

    if (error) showAlert(error.message, 'danger')
    else setExpenses(data || [])
  }

  useEffect(() => {
    fetchDeliveries()
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
    const trimmedCode = scannedCode?.trim().replace(/\//g, '-')
    if (!trimmedCode) return

    const foundBag = bags.find(
      (bag) => String(bag.code_bar || '').trim().toLowerCase() === trimmedCode.toLowerCase(),
    )

    if (foundBag) {
      setDeliveryItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex(
          (item) => Number(item.bag_id) === foundBag.bag_id,
        )
        const currentQtyInCart =
          existingItemIndex >= 0 ? Number(prevItems[existingItemIndex].quantity || 0) : 0

        if (currentQtyInCart + 1 > foundBag.warehouse_stock) {
          showAlert(
            `Stock insuficiente en almacén para ${foundBag.model_name}. Disponibles: ${foundBag.warehouse_stock}`,
            'danger',
          )
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
      showAlert(`No se encontró ningún bolso con el código: ${trimmedCode}`, 'warning')
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return
      }

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

  // CREAR NOTA DE ENTREGA (CON VALIDACIÓN ZOD Y CONTROL DE STOCK)
  const handleCreateDeliveryNote = async () => {
    const payload = {
      id_store: newDeliveryStore || '',
      items: deliveryItems,
    }

    const validationErrors = getValidationErrors(createDeliverySchema, payload)
    if (Object.keys(validationErrors).length > 0) {
      setDeliveryErrors(validationErrors)
      return
    }

    const itemTotals = {}
    for (const item of deliveryItems) {
      const bagId = Number(item.bag_id)
      const qty = Number(item.quantity)
      itemTotals[bagId] = (itemTotals[bagId] || 0) + qty
    }

    for (const [bagIdStr, qty] of Object.entries(itemTotals)) {
      const bagId = Number(bagIdStr)
      const bag = bags.find((b) => b.bag_id === bagId)
      if (!bag) {
        showAlert('Uno de los productos seleccionados no existe', 'danger')
        return
      }
      if (qty > bag.warehouse_stock) {
        showAlert(
          `Stock insuficiente para ${bag.model_name}. Solicitado: ${qty}, Disponible en almacén: ${bag.warehouse_stock}`,
          'danger',
        )
        return
      }
    }

    setIsUploading(true)
    try {
      const storedUser = JSON.parse(
        sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}',
      )
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        showAlert('Sesión no válida o expirada. Por favor vuelva a iniciar sesión.', 'danger')
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

      for (const [bagIdStr, qty] of Object.entries(itemTotals)) {
        const bagId = Number(bagIdStr)
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
      setSearchClientCode('')
      setNewDeliveryStore('')
      setFoundStore(null)
      setDeliveryItems([])
      setDeliveryErrors({})
      fetchDeliveries()
      fetchBags()
      showAlert('Nota de entrega registrada y stock actualizado con éxito', 'success')
    } catch (error) {
      showAlert(error.message, 'danger')
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
    setSettlementErrors({})
    setPaymentMethod('Cash')

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

  const calculatedTotal = deliveryDetails.reduce((sum, det) => {
    const sold = Number(settlementData[det.detail_id]?.sold) || 0
    return sum + sold * Number(det.bags?.sale_price || 0)
  }, 0)

  // LIQUIDAR NOTA DE ENTREGA (CON VALIDACIÓN DE ERRORES EN TABLA)
  const handleConfirmSettlement = async () => {
    if (invoiceHistory.length > 0) {
      showAlert('Esta entrega ya tiene facturas registradas.', 'warning')
      return
    }

    let amountTotal = 0
    let hasErrors = false
    const newSettlementErrors = {}

    for (const det of deliveryDetails) {
      const detailId = det.detail_id
      const info = settlementData[detailId] || {}

      const itemValidation = settlementItemSchema.safeParse({
        sold: info.sold,
        returned: info.returned,
        delivered: Number(det.delivered_quantity),
      })

      if (!itemValidation.success) {
        newSettlementErrors[detailId] = itemValidation.error.issues[0].message
        hasErrors = true
      } else {
        amountTotal += Number(info.sold || 0) * Number(det.bags?.sale_price || 0)
      }
    }

    if (hasErrors) {
      setSettlementErrors(newSettlementErrors)
      showAlert('Por favor, corrija los errores en las cantidades.', 'warning')
      return
    }

    setSettlementErrors({})

    if (paymentMethod === 'mix') {
      const cashVal = Number(amountCash) || 0
      const transVal = Number(amountTransfer) || 0
      if (Math.abs(cashVal + transVal - amountTotal) > 0.01) {
        showAlert(
          `Los montos no coinciden. El total a liquidar es $${amountTotal.toFixed(
            2,
          )}, pero la suma de Efectivo ($${cashVal}) y Transferencia ($${transVal}) es $${(
            cashVal + transVal
          ).toFixed(2)}.`,
          'danger',
        )
        return
      }
    }

    if (
      (paymentMethod === 'Bank_Transfer' || paymentMethod === 'mix') &&
      !receiptFile &&
      amountTotal > 0
    ) {
      showAlert('Debe adjuntar el comprobante de pago de la transferencia', 'warning')
      return
    }

    setIsUploading(true)
    try {
      let receiptUrl = null
      if ((paymentMethod === 'Bank_Transfer' || paymentMethod === 'mix') && receiptFile) {
        receiptUrl = await uploadReceiptToBackend(receiptFile)
      }

      const storedUser = JSON.parse(
        sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}',
      )
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        showAlert('Sesión no válida o expirada. Por favor vuelva a iniciar sesión.', 'danger')
        setIsUploading(false)
        return
      }

      const isReturned = amountTotal === 0
      const finalPaymentStatus = isReturned ? 'returned' : 'paid'

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
        amount_cash: finalAmountCash,
        amount_transfer: finalAmountTransfer,
        payment_method: paymentMethod,
        payment_receipt_url: receiptUrl,
        payment_status: finalPaymentStatus,
        payment_date: paymentDate || getLocalDateTimeValue(),
        notes:
          paymentNotes.trim() ||
          `Liquidación #${selectedDelivery.delivery_id} - ${
            isReturned ? 'Devolución total de mercancía' : getPaymentMethodLabel(paymentMethod)
          }`,
      }

      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single()

      if (invoiceError) {
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

      for (const det of deliveryDetails) {
        const detailId = det.detail_id
        const info = settlementData[detailId]
        const sold = Number(info.sold) || 0
        const returned = Number(info.returned) || 0

        await supabase
          .from('delivery_details')
          .update({
            sold_quantity: sold,
            returned_quantity: returned,
          })
          .eq('detail_id', Number(detailId))

        const bag = bags.find((b) => b.bag_id === det.bag_id)
        if (bag) {
          await supabase
            .from('bags')
            .update({
              total_stock: bag.total_stock - sold,
              consigned_stock: bag.consigned_stock - (sold + returned),
              warehouse_stock: bag.warehouse_stock + returned,
            })
            .eq('bag_id', det.bag_id)
        }
      }

      setSettleModal(false)
      fetchDeliveries()
      fetchBags()
      showAlert('Liquidación procesada y factura generada con éxito', 'success')
    } catch (error) {
      showAlert(error.message, 'danger')
    } finally {
      setIsUploading(false)
    }
  }

  // GUARDAR GASTO
  const handleSaveExpense = async () => {
    const validationErrors = getValidationErrors(createExpenseSchema, newExpense)
    if (Object.keys(validationErrors).length > 0) {
      setExpenseErrors(validationErrors)
      return
    }

    try {
      const storedUser = JSON.parse(
        sessionStorage.getItem('user') || localStorage.getItem('userInfo') || '{}',
      )
      const internalUserId = storedUser.id_user

      if (!internalUserId) {
        showAlert('Sesión no válida o expirada. Vuelva a iniciar sesión.', 'danger')
        return
      }

      const { error } = await supabase.from('expenses').insert([
        {
          id_user: internalUserId,
          amount: Number(newExpense.amount),
          description: newExpense.description.trim(),
          expense_date: getLocalDateTimeValue(),
        },
      ])

      if (error) throw error

      setExpenseModal(false)
      setNewExpense({ amount: '', description: '' })
      setExpenseErrors({})
      fetchExpenses()
      showAlert('Gasto registrado correctamente', 'success')
    } catch (error) {
      showAlert(error.message, 'danger')
    }
  }

  const downloadReportPDF = (reportType) => {
    const doc = new jsPDF()
    const now = new Date()
    const startDate = new Date(now)

    if (reportType === 'weekly') {
      const dayOfWeek = now.getDay()
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startDate.setDate(now.getDate() - diffToMonday)
    }

    startDate.setHours(0, 0, 0, 0)

    const dailyData = {}
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString()
      dailyData[dateStr] = { paid: 0, pending: 0, returned: 0, totalSales: 0, totalExpenses: 0 }
    }

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

    expenses.forEach((exp) => {
      const expDate = new Date(exp.expense_date)
      if (expDate >= startDate && expDate <= now) {
        const dateStr = expDate.toLocaleDateString()
        if (dailyData[dateStr]) {
          dailyData[dateStr].totalExpenses += Number(exp.amount) || 0
        }
      }
    })

    const tableColumn = [
      'Fecha',
      'Pagadas',
      'Pendientes',
      'Devueltas',
      'Ingresos',
      'Gastos',
      'Total Neto',
    ]
    const tableRows = []

    let grandTotalSales = 0
    let grandTotalExpenses = 0
    let grandNetTotal = 0
    let totalPending = 0
    let totalPaid = 0
    let totalReturned = 0

    Object.keys(dailyData).forEach((date) => {
      const day = dailyData[date]
      const netBalance = day.totalSales - day.totalExpenses

      const rowData = [
        date,
        day.paid.toString(),
        day.pending.toString(),
        day.returned.toString(),
        `$${day.totalSales.toFixed(2)}`,
        `$${day.totalExpenses.toFixed(2)}`,
        `$${netBalance.toFixed(2)}`,
      ]
      tableRows.push(rowData)

      grandTotalSales += day.totalSales
      grandTotalExpenses += day.totalExpenses
      grandNetTotal += netBalance

      totalPaid += day.paid
      totalPending += day.pending
      totalReturned += day.returned
    })

    doc.setFontSize(18)
    const pdfTitle = reportType === 'weekly' ? 'Reporte Semanal (Lun - Hoy)' : 'Reporte Diario'
    doc.text(`${pdfTitle} de Ventas y Gastos`, 14, 22)

    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(
      `Periodo evaluado: ${startDate.toLocaleDateString()} al ${now.toLocaleDateString()}`,
      14,
      30,
    )

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
          `$${grandTotalSales.toFixed(2)}`,
          `$${grandTotalExpenses.toFixed(2)}`,
          `$${grandNetTotal.toFixed(2)}`,
        ],
      ],
      footStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    })

    const fileName =
      reportType === 'weekly' ? 'Reporte_Semanal_Ventas.pdf' : 'Reporte_Diario_Ventas.pdf'
    doc.save(fileName)
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

                <CButton
                  color={filterPending ? 'secondary' : 'light'}
                  onClick={() => setFilterPending(!filterPending)}
                  className="shadow-sm text-nowrap"
                >
                  <CIcon icon={cilFilter} className="me-1" />
                  {filterPending ? 'Mostrando Pendientes' : 'Filtrar Pendientes'}
                </CButton>

                <CButton
                  color="info"
                  className="text-white shadow-sm text-nowrap"
                  onClick={() => downloadReportPDF('daily')}
                >
                  <CIcon icon={cilCloudDownload} className="me-1" />
                  Reporte Diario
                </CButton>
                <CButton
                  color="success"
                  className="text-white shadow-sm text-nowrap"
                  onClick={() => downloadReportPDF('weekly')}
                >
                  <CIcon icon={cilCloudDownload} className="me-1" />
                  Reporte Semanal
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
                                  del.invoices && del.invoices.length > 0
                                    ? del.invoices[0]
                                    : null
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
      <CModal
        visible={addDeliveryModal}
        backdrop="static"
        keyboard={false}
        onClose={() => {
          setAddDeliveryModal(false)
          setSearchClientCode('')
          setNewDeliveryStore('')
          setFoundStore(null)
          setDeliveryItems([])
          setDeliveryErrors({})
        }}
        size="lg"
      >
        <CModalHeader
          onClose={() => {
            setAddDeliveryModal(false)
            setSearchClientCode('')
            setNewDeliveryStore('')
            setFoundStore(null)
            setDeliveryItems([])
            setDeliveryErrors({})
          }}
        >
          <CModalTitle>Crear Nota de Entrega (Consignación)</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-4 position-relative">
              <CFormInput
                type="text"
                label="Código de Cliente"
                placeholder="Ej: Barinas-36"
                value={searchClientCode}
                invalid={Boolean(deliveryErrors.id_store)}
                onChange={(e) => {
                  setSearchClientCode(e.target.value)
                  setNewDeliveryStore('')
                  setFoundStore(null)
                  if (deliveryErrors.id_store) setDeliveryErrors({ ...deliveryErrors, id_store: '' })
                }}
              />
              {deliveryErrors.id_store && <div className="text-danger small mt-1">{deliveryErrors.id_store}</div>}

              {searchClientCode && !newDeliveryStore && (
                <CListGroup
                  className="position-absolute w-100 shadow-sm"
                  style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}
                >
                  {stores
                    .filter((st) =>
                      st.code_customer?.toLowerCase().includes(searchClientCode.toLowerCase()),
                    )
                    .map((st) => (
                      <CListGroupItem
                        component="button"
                        type="button"
                        key={st.id_store}
                        onClick={() => {
                          setSearchClientCode(st.code_customer)
                          setNewDeliveryStore(st.id_store)
                          setFoundStore(st)
                          setDeliveryErrors({ ...deliveryErrors, id_store: '' })
                        }}
                      >
                        <strong>{st.code_customer}</strong> - Local {st.number_store}
                      </CListGroupItem>
                    ))}
                  {stores.filter((st) =>
                    st.code_customer?.toLowerCase().includes(searchClientCode.toLowerCase()),
                  ).length === 0 && (
                    <CListGroupItem>No se encontraron clientes con ese código</CListGroupItem>
                  )}
                </CListGroup>
              )}

              {newDeliveryStore && foundStore && (
                <div className="text-success mt-1 small">
                  <CIcon icon={cilCheckCircle} className="me-1" />
                  Cliente seleccionado: {foundStore.code_customer} (Local {foundStore.number_store})
                </div>
              )}
            </div>

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
              />
              <small className="text-muted">
                El artículo se agregará automáticamente al escanear.
              </small>
            </div>

            <h6 className="fw-bold">Artículos a entregar</h6>
            {deliveryErrors.items && <div className="text-danger small mb-2">{deliveryErrors.items}</div>}
            
            {deliveryItems.map((item, index) => (
              <div key={index} className="mb-2">
                <div className="d-flex gap-2 align-items-end">
                  <div className="w-100">
                    <CFormSelect
                      label="Bolso"
                      value={item.bag_id}
                      invalid={Boolean(deliveryErrors[`items.${index}.bag_id`])}
                      onChange={(e) => {
                        handleItemChange(index, 'bag_id', e.target.value)
                        if (deliveryErrors[`items.${index}.bag_id`]) {
                          setDeliveryErrors({ ...deliveryErrors, [`items.${index}.bag_id`]: '' })
                        }
                      }}
                    >
                      <option value="">Seleccione Bolso</option>
                      {bags.map((b) => (
                        <option key={b.bag_id} value={b.bag_id}>
                          {b.model_name} (Almacén: {b.warehouse_stock})
                        </option>
                      ))}
                    </CFormSelect>
                  </div>
                  <div className="w-100">
                    <CFormInput
                      type="number"
                      min="1"
                      step="1"
                      label="Cantidad"
                      value={item.quantity}
                      invalid={Boolean(deliveryErrors[`items.${index}.quantity`])}
                      onChange={(e) => {
                        handleItemChange(index, 'quantity', e.target.value)
                        if (deliveryErrors[`items.${index}.quantity`]) {
                          setDeliveryErrors({ ...deliveryErrors, [`items.${index}.quantity`]: '' })
                        }
                      }}
                    />
                  </div>
                  <CButton color="danger" size="sm" onClick={() => handleRemoveItem(index)}>
                    <CIcon icon={cilTrash} className="text-white" />
                  </CButton>
                </div>
                {deliveryErrors[`items.${index}.bag_id`] && <div className="text-danger small">{deliveryErrors[`items.${index}.bag_id`]}</div>}
                {deliveryErrors[`items.${index}.quantity`] && <div className="text-danger small">{deliveryErrors[`items.${index}.quantity`]}</div>}
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
          <CButton
            color="secondary"
            onClick={() => {
              setAddDeliveryModal(false)
              setSearchClientCode('')
              setNewDeliveryStore('')
              setFoundStore(null)
              setDeliveryItems([])
              setDeliveryErrors({})
            }}
          >
            Cancelar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* --- MODAL LIQUIDACIÓN (Settlement) --- */}
      <CModal
        visible={settleModal}
        backdrop="static"
        keyboard={false}
        onClose={() => {
          setSettleModal(false)
          setSettlementErrors({})
        }}
        size="lg"
      >
        <CModalHeader onClose={() => {
          setSettleModal(false)
          setSettlementErrors({})
        }} className="bg-success text-white">
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

                        {Number(invoice.amount_cash) > 0 || Number(invoice.amount_transfer) > 0 ? (
                          <>
                            {Number(invoice.amount_cash) > 0 && (
                              <div>Efectivo: ${invoice.amount_cash}</div>
                            )}
                            {Number(invoice.amount_transfer) > 0 && (
                              <div>Transferencia: ${invoice.amount_transfer}</div>
                            )}
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
                              min="0"
                              max={det.delivered_quantity}
                              step="1"
                              placeholder="0"
                              value={settlementData[det.detail_id]?.sold ?? ''}
                              invalid={Boolean(settlementErrors[det.detail_id])}
                              onChange={(e) => {
                                handleSettlementChange(det.detail_id, 'sold', e.target.value)
                                if (settlementErrors[det.detail_id]) {
                                  setSettlementErrors({ ...settlementErrors, [det.detail_id]: '' })
                                }
                              }}
                            />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CFormInput
                              type="number"
                              min="0"
                              max={det.delivered_quantity}
                              step="1"
                              placeholder="0"
                              value={settlementData[det.detail_id]?.returned ?? ''}
                              invalid={Boolean(settlementErrors[det.detail_id])}
                              onChange={(e) => {
                                handleSettlementChange(det.detail_id, 'returned', e.target.value)
                                if (settlementErrors[det.detail_id]) {
                                  setSettlementErrors({ ...settlementErrors, [det.detail_id]: '' })
                                }
                              }}
                            />
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                  
                  {Object.keys(settlementErrors).length > 0 && (
                    <div className="text-danger small text-center mb-3">
                      * Las cantidades de algunos bolsos son incorrectas o están en blanco.
                    </div>
                  )}

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

                  {paymentMethod === 'mix' && (
                    <div className="d-flex gap-2 mb-3">
                      <CFormInput
                        type="number"
                        min="0"
                        step="0.01"
                        label="Monto en Efectivo"
                        placeholder="Ej: 50"
                        value={amountCash}
                        onChange={(e) => setAmountCash(e.target.value)}
                      />
                      <CFormInput
                        type="number"
                        min="0"
                        step="0.01"
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
                <CButton color="secondary" onClick={() => {
                  setSettleModal(false)
                  setSettlementErrors({})
                }}>
                  Cancelar
                </CButton>
              </div>
            </div>
          )}
        </CModalBody>
      </CModal>

      {/* --- MODAL DETALLE DE GASTO --- */}
      <CModal visible={viewModal} backdrop="static" keyboard={false} onClose={() => setViewModal(false)}>
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
                <strong>Monto:</strong> ${selectedExpense.amount}
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
      <CModal visible={expenseModal} backdrop="static" keyboard={false} onClose={() => {
        setExpenseModal(false)
        setExpenseErrors({})
      }}>
        <CModalHeader onClose={() => {
          setExpenseModal(false)
          setExpenseErrors({})
        }}>
          <CModalTitle>Registrar Gasto Administrativo / Extra</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              type="number"
              min="0.01"
              step="0.01"
              label="Monto ($)"
              value={newExpense.amount}
              invalid={Boolean(expenseErrors.amount)}
              onChange={(e) => {
                setNewExpense({ ...newExpense, amount: e.target.value })
                if (expenseErrors.amount) setExpenseErrors({ ...expenseErrors, amount: '' })
              }}
              className="mb-2"
            />
            {expenseErrors.amount && <div className="text-danger small mb-2">{expenseErrors.amount}</div>}

            <CFormInput
              label="Descripción (Ej: Gasolina, estacionamiento)"
              value={newExpense.description}
              invalid={Boolean(expenseErrors.description)}
              onChange={(e) => {
                setNewExpense({ ...newExpense, description: e.target.value })
                if (expenseErrors.description) setExpenseErrors({ ...expenseErrors, description: '' })
              }}
              className="mb-2"
            />
            {expenseErrors.description && <div className="text-danger small mb-2">{expenseErrors.description}</div>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="warning" className="text-white" onClick={handleSaveExpense}>
            Guardar Gasto
          </CButton>
          <CButton color="secondary" onClick={() => {
            setExpenseModal(false)
            setExpenseErrors({})
          }}>
            Cancelar
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Alerta flotante superpuesta */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          minWidth: '300px',
        }}
      >
        {alertData && (
          <AlertMessage
            response={alertData.response}
            type={alertData.type}
            onClose={() => setAlertData(null)}
          />
        )}
      </div>
    </div>
  )
}

export default Sales