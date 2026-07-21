import { useState, useEffect } from 'react'
import { supabase } from '../../config/supabaseClient'
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  CFormSelect
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMoney, cilLayers, cilCart, cilCloudDownload, cilStar } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalSalesAmount: 0,
    totalCashSales: 0,       // NUEVO: Total en efectivo
    totalTransferSales: 0,   // NUEVO: Total en transferencias
    activeDeliveriesCount: 0,
    totalWarehouseStock: 0,
    totalConsignedStock: 0,
    totalStoresCount: 0,
    totalMallsCount: 0,
  })
  
  const [allInvoices, setAllInvoices] = useState([]) // Guardamos todas las facturas para poder filtrar por mes
  const [recentInvoices, setRecentInvoices] = useState([])
  const [lowStockBags, setLowStockBags] = useState([])
  const [alertData, setAlertData] = useState(null)
  
  const [bestSellingBag, setBestSellingBag] = useState({ name: 'N/A', qty: 0 })
  const [caStats, setCaStats] = useState({
    breakdown: [],
    totalInvestment: 0,
    totalExpectedProfit: 0,
    totalSold: 0,
    totalRealizedProfit: 0
  })

  // Estado para el selector de meses
  const [selectedMonth, setSelectedMonth] = useState('0')

  const fetchDashboardData = async () => {
    try {
      // 1. Obtener Facturas / Ventas totales
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('*, delivery_notes(stores(code_customer, number_store))')
        .order('date_billing', { ascending: false })

      if (invError) throw invError

      setAllInvoices(invoices || []) // Guardar historial completo
      setRecentInvoices(invoices?.slice(0, 5) || [])

      // NUEVO: Calcular ventas totales, en efectivo y por transferencia
      let totalSales = 0
      let totalCash = 0
      let totalTransfer = 0

      invoices?.forEach(inv => {
        const amount = Number(inv.amount_total) || 0
        totalSales += amount
        
        // Verificamos si el método de pago es "Cash" o "Efectivo"
        const method = (inv.payment_method || '').toLowerCase()
        if (method === 'cash' || method === 'efectivo') {
          totalCash += amount
        } else {
          // Asumimos que cualquier otra cosa (Transfer, Zelle, Pago Móvil) cuenta como transferencia
          totalTransfer += amount
        }
      })

      // 2. Notas de entrega activas
      const { count: deliveriesCount, error: delError } = await supabase
        .from('delivery_notes')
        .select('*', { count: 'exact', head: true })

      if (delError) throw delError

      // 3. Inventario de bolsos
      const { data: bags, error: bagError } = await supabase
        .from('bags')
        .select('*')

      if (bagError) throw bagError

      // Filtramos solo los activos para el stock general
      const activeBags = bags?.filter(b => (b.status || '').toLowerCase() === 'active') || []
      const warehouseStock = activeBags.reduce((acc, curr) => acc + Number(curr.warehouse_stock || 0), 0)
      const consignedStock = activeBags.reduce((acc, curr) => acc + Number(curr.consigned_stock || 0), 0)
      
      const lowStock = activeBags.filter(b => Number(b.warehouse_stock || 0) <= 5) || []
      setLowStockBags(lowStock)

      // 4. Clientes y Centros Comerciales
      const { count: storesCount } = await supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })

      const { count: mallsCount } = await supabase
        .from('malls')
        .select('*', { count: 'exact', head: true })

      setMetrics({
        totalSalesAmount: totalSales,
        totalCashSales: totalCash,           // Guardar métrica efectivo
        totalTransferSales: totalTransfer,   // Guardar métrica transferencia
        activeDeliveriesCount: deliveriesCount || 0,
        totalWarehouseStock: warehouseStock,
        totalConsignedStock: consignedStock,
        totalStoresCount: storesCount || 0,
        totalMallsCount: mallsCount || 0,
      })

      // 5. Calcular ventas generales y mapa de ventas por código
      const { data: deliveryDetails } = await supabase
        .from('delivery_details')
        .select('sold_quantity, bags(model_name, code_bar)')
      
      let bestBag = { name: 'N/A', qty: 0 }
      const salesByCode = {} 

      if (deliveryDetails) {
        const salesMap = {}
        deliveryDetails.forEach(d => {
          if (d.bags && d.sold_quantity > 0) {
            const mName = d.bags.model_name || 'Desconocido'
            const cBar = d.bags.code_bar || ''
            
            salesMap[mName] = (salesMap[mName] || 0) + Number(d.sold_quantity)
            
            if (cBar) {
              salesByCode[cBar] = (salesByCode[cBar] || 0) + Number(d.sold_quantity)
            }
          }
        })
        for (const [name, qty] of Object.entries(salesMap)) {
          if (qty > bestBag.qty) {
            bestBag = { name, qty }
          }
        }
      }
      setBestSellingBag(bestBag)

      // 6. Filtrar y procesar bolsos CA / Carla
      const caFiltered = bags?.filter(b => {
        const code = (b.code_bar || '').toLowerCase().trim()
        const model = (b.model_name || '').toLowerCase().trim()
        return code.startsWith('ca') || code.includes('carla') || model.startsWith('ca') || model.includes('carla')
      }) || []

      const caBreakdown = []
      let totalCAInv = 0
      let totalCAProfit = 0
      let totalCASold = 0
      let totalCARealizedProfit = 0

      caFiltered.forEach(b => {
        const tStock = (b.total_stock !== undefined && b.total_stock !== null)
          ? Number(b.total_stock) 
          : (Number(b.warehouse_stock || 0) + Number(b.consigned_stock || 0))
        
        const cost = Number(b.investment_cost) || 0
        const price = Number(b.sale_price) || 0
        
        const investment = cost * tStock
        const expectedProfit = (price - cost) * tStock
        
        const soldQty = salesByCode[b.code_bar] || 0
        const realizedProfit = soldQty * (price - cost)

        caBreakdown.push({
          model: b.model_name || 'N/A',
          code: b.code_bar || 'N/A',
          stock: tStock,
          sold: soldQty,
          investment: investment,
          expectedProfit: expectedProfit,
          realizedProfit: realizedProfit
        })

        totalCAInv += investment
        totalCAProfit += expectedProfit
        totalCASold += soldQty
        totalCARealizedProfit += realizedProfit
      })

      setCaStats({
        breakdown: caBreakdown,
        totalInvestment: totalCAInv,
        totalExpectedProfit: totalCAProfit,
        totalSold: totalCASold,
        totalRealizedProfit: totalCARealizedProfit
      })

    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // --- Funciones de Descarga CSV Corregidas para Excel ---
  const downloadCSV = (content, fileName) => {
    const bom = '\uFEFF'
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportGeneralStats = () => {
    let exportSales = metrics.totalSalesAmount
    let exportCash = metrics.totalCashSales
    let exportTransfer = metrics.totalTransferSales
    let fileName = 'Estadisticas_Generales_Historico.csv'

    // Si se seleccionó un mes específico, filtramos y recalculamos ventas por método
    if (selectedMonth !== '0') {
      const monthInt = parseInt(selectedMonth)
      const year = new Date().getFullYear()

      const monthInvoices = allInvoices.filter(inv => {
        if (!inv.date_billing) return false
        const invDate = new Date(inv.date_billing)
        return (invDate.getMonth() + 1) === monthInt && invDate.getFullYear() === year
      })

      exportSales = 0
      exportCash = 0
      exportTransfer = 0

      monthInvoices.forEach(inv => {
        const amount = Number(inv.amount_total) || 0
        exportSales += amount
        const method = (inv.payment_method || '').toLowerCase()
        if (method === 'cash' || method === 'efectivo') {
          exportCash += amount
        } else {
          exportTransfer += amount
        }
      })
      
      const monthNames = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      fileName = `Estadisticas_${monthNames[monthInt]}.csv`
    }

    const rows = [
      ['Métrica', 'Valor'],
      ['Facturación Total (COP)', exportSales.toFixed(2)],
      ['Facturación Efectivo (COP)', exportCash.toFixed(2)],
      ['Facturación Transferencia (COP)', exportTransfer.toFixed(2)],
      ['Notas de Entrega Activas', metrics.activeDeliveriesCount],
      ['Total Stock Almacén', metrics.totalWarehouseStock],
      ['Total Stock Consignado', metrics.totalConsignedStock],
      ['Locales Totales', metrics.totalStoresCount],
      ['Centros Comerciales', metrics.totalMallsCount],
      ['Bolso Más Vendido (Modelo)', bestSellingBag.name],
      ['Bolso Más Vendido (Cantidad)', bestSellingBag.qty]
    ]
    
    const csvContent = rows.map(r => r.join(';')).join('\n')
    downloadCSV(csvContent, fileName)
  }

  const exportCAStats = () => {
    const rows = [
      ['Modelo', 'Codigo de Barras', 'Stock Actual', 'Unidades Vendidas', 'Inversion Actual (COP)', 'Ganancia Proyectada (COP)', 'Ganancia Realizada (COP)']
    ]
    caStats.breakdown.forEach(b => {
      rows.push([b.model, b.code, b.stock, b.sold, b.investment.toFixed(2), b.expectedProfit.toFixed(2), b.realizedProfit.toFixed(2)])
    })
    rows.push([])
    rows.push(['TOTALES', '', '', caStats.totalSold, caStats.totalInvestment.toFixed(2), caStats.totalExpectedProfit.toFixed(2), caStats.totalRealizedProfit.toFixed(2)])
    
    const csvContent = rows.map(r => r.join(';')).join('\n')
    downloadCSV(csvContent, 'Estadisticas_CA_Carla.csv')
  }

  return (
    <div className="p-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <h3 className="mb-0">Panel de Estadísticas y Control</h3>
        
        {/* Controles de exportación y selector de mes */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <CFormSelect 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto', minWidth: '200px' }}
          >
            <option value="0">General (Histórico Completo)</option>
            <option value="1">Estadísticas - Enero</option>
            <option value="2">Estadísticas - Febrero</option>
            <option value="3">Estadísticas - Marzo</option>
            <option value="4">Estadísticas - Abril</option>
            <option value="5">Estadísticas - Mayo</option>
            <option value="6">Estadísticas - Junio</option>
            <option value="7">Estadísticas - Julio</option>
            <option value="8">Estadísticas - Agosto</option>
            <option value="9">Estadísticas - Septiembre</option>
            <option value="10">Estadísticas - Octubre</option>
            <option value="11">Estadísticas - Noviembre</option>
            <option value="12">Estadísticas - Diciembre</option>
          </CFormSelect>

          <CButton color="primary" variant="outline" onClick={exportGeneralStats}>
            <CIcon icon={cilCloudDownload} className="me-2" />
            Descargar General
          </CButton>
          <CButton color="success" variant="outline" onClick={exportCAStats}>
            <CIcon icon={cilCloudDownload} className="me-2" />
            Línea CA/Carla
          </CButton>
        </div>
      </div>

      {/* --- TARJETAS DE MÉTRICAS CLAVE (KPIs) --- */}
      <CRow className="mb-4">
        
        {/* TARJETA MODIFICADA PARA DESGLOSE EFECTIVO/TRANSFERENCIA */}
        <CCol sm={6} lg={3} className="mb-3">
          <CCard className="text-white bg-primary h-100 d-flex flex-column">
            <CCardBody className="d-flex flex-column justify-content-between">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div className="text-value-lg">COP {metrics.totalSalesAmount.toFixed(2)}</div>
                  <div>Facturación Total</div>
                </div>
                <CIcon icon={cilMoney} height={36} />
              </div>
              
              {/* Desglose en la parte inferior de la tarjeta */}
              <div className="d-flex justify-content-between text-sm mt-3 pt-3 border-top border-light border-opacity-50">
                <div>
                  <small className="opacity-75 d-block">Efectivo</small>
                  <span className="fw-semibold">COP {metrics.totalCashSales.toFixed(2)}</span>
                </div>
                <div className="text-end">
                  <small className="opacity-75 d-block">Transferencia</small>
                  <span className="fw-semibold">COP {metrics.totalTransferSales.toFixed(2)}</span>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol sm={6} lg={3} className="mb-3">
          <CCard className="text-white bg-warning h-100">
            <CCardBody className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-value-lg">{metrics.activeDeliveriesCount}</div>
                <div>Notas Registradas</div>
              </div>
              <CIcon icon={cilLayers} height={36} />
            </CCardBody>
          </CCard>
        </CCol>

        <CCol sm={6} lg={3} className="mb-3">
          <CCard className="text-white bg-info h-100">
            <CCardBody className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-value-lg">{metrics.totalWarehouseStock} / {metrics.totalConsignedStock}</div>
                <div>Stock Almacén / Pendiente</div>
              </div>
              <CIcon icon={cilCart} height={36} />
            </CCardBody>
          </CCard>
        </CCol>

        <CCol sm={6} lg={3} className="mb-3">
          <CCard className="text-white bg-success h-100">
            <CCardBody className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-value-lg">{bestSellingBag.qty} vendidos</div>
                <div className="fw-bold">{bestSellingBag.name}</div>
                <div className="small opacity-75">Bolso más vendido</div>
              </div>
              <CIcon icon={cilStar} height={36} />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* --- SECCIÓN LÍNEA CA / CARLA --- */}
      <CRow className="mb-4">
        <CCol xs={12}>
          <CCard className="shadow-sm">
            <CCardHeader className="bg-success text-white fw-semibold">
              Desglose Línea Especial (CA / Carla)
            </CCardHeader>
            <CCardBody>
              <CRow className="mb-3">
                <CCol sm={6} lg={3} className="mb-2">
                  <div className="border rounded p-3 bg-light text-center h-100">
                    <h6 className="text-muted mb-1">Inversión (Stock)</h6>
                    <h4 className="mb-0 text-dark">COP {caStats.totalInvestment.toFixed(2)}</h4>
                  </div>
                </CCol>
                <CCol sm={6} lg={3} className="mb-2">
                  <div className="border rounded p-3 bg-light text-center h-100">
                    <h6 className="text-muted mb-1">Ganancia Proyectada</h6>
                    <h4 className="mb-0 text-success">COP {caStats.totalExpectedProfit.toFixed(2)}</h4>
                  </div>
                </CCol>
                <CCol sm={6} lg={3} className="mb-2">
                  <div className="border rounded p-3 bg-light text-center h-100">
                    <h6 className="text-muted mb-1">Bolsos Vendidos</h6>
                    <h4 className="mb-0 text-primary">{caStats.totalSold} Unds</h4>
                  </div>
                </CCol>
                <CCol sm={6} lg={3} className="mb-2">
                  <div className="border rounded p-3 bg-light text-center h-100">
                    <h6 className="text-muted mb-1">Ganancia Realizada</h6>
                    <h4 className="mb-0 text-info">COP {caStats.totalRealizedProfit.toFixed(2)}</h4>
                  </div>
                </CCol>
              </CRow>
              <CTable hover responsive align="middle" className="mb-0 border">
                <CTableHead color="light">
                  <CTableRow>
                    <CTableHeaderCell>Modelo</CTableHeaderCell>
                    <CTableHeaderCell>Código</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Stock Actual</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Vendidos</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">Inversión</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">G. Esperada</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">G. Realizada</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {caStats.breakdown.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className="text-center text-muted py-3">No hay registros de esta línea.</CTableDataCell>
                    </CTableRow>
                  ) : (
                    caStats.breakdown.map((item, idx) => (
                      <CTableRow key={idx}>
                        <CTableDataCell className="fw-semibold">{item.model}</CTableDataCell>
                        <CTableDataCell><CBadge color="secondary">{item.code}</CBadge></CTableDataCell>
                        <CTableDataCell className="text-center">{item.stock}</CTableDataCell>
                        <CTableDataCell className="text-center fw-bold text-primary">{item.sold}</CTableDataCell>
                        <CTableDataCell className="text-end text-danger">COP {item.investment.toFixed(2)}</CTableDataCell>
                        <CTableDataCell className="text-end text-success">COP {item.expectedProfit.toFixed(2)}</CTableDataCell>
                        <CTableDataCell className="text-end text-info fw-bold">COP {item.realizedProfit.toFixed(2)}</CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* --- TABLAS DE RESUMEN / ALERTAS --- */}
      <CRow>
        <CCol md={6} className="mb-4">
          <CCard className="h-100 shadow-sm border-0">
            <CCardHeader className="bg-light">Últimas Facturas / Liquidaciones</CCardHeader>
            <CCardBody>
              <CTable hover responsive align="middle" className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>ID</CTableHeaderCell>
                    <CTableHeaderCell>Fecha</CTableHeaderCell>
                    <CTableHeaderCell>Método</CTableHeaderCell>
                    <CTableHeaderCell>Monto</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {recentInvoices.map((inv) => (
                    <CTableRow key={inv.invoice_id}>
                      <CTableDataCell>#{inv.invoice_id}</CTableDataCell>
                      <CTableDataCell>{new Date(inv.date_billing).toLocaleDateString()}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={inv.payment_method === 'Cash' ? 'success' : 'info'}>
                          {inv.payment_method}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="fw-semibold">COP {Number(inv.amount_total).toFixed(2)}</CTableDataCell>
                    </CTableRow>
                  ))}
                  {recentInvoices.length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan={4} className="text-center text-muted">No hay facturas recientes</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={6} className="mb-4">
          <CCard className="h-100 shadow-sm border-0">
            <CCardHeader className="text-danger fw-semibold bg-light">Alertas: Stock Bajo en Almacén (≤ 5)</CCardHeader>
            <CCardBody>
              <CTable hover responsive align="middle" className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Modelo</CTableHeaderCell>
                    <CTableHeaderCell>Almacén</CTableHeaderCell>
                    <CTableHeaderCell>Pendiente</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {lowStockBags.map((bag) => (
                    <CTableRow key={bag.bag_id}>
                      <CTableDataCell>{bag.model_name}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="danger" shape="rounded-pill">{bag.warehouse_stock}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{bag.consigned_stock}</CTableDataCell>
                    </CTableRow>
                  ))}
                  {lowStockBags.length === 0 && (
                    <CTableRow>
                      <CTableDataCell colSpan={3} className="text-center text-muted">No hay productos con stock bajo</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Alertas Globales */}
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

export default Dashboard