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
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMoney, cilLayers, cilCart, cilCloudDownload, cilStar } from '@coreui/icons'
import AlertMessage from '../../components/ui/AlertMessage'

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalSalesAmount: 0,
    totalCashSales: 0,
    totalTransferSales: 0,
    activeDeliveriesCount: 0,
    totalWarehouseStock: 0,
    totalConsignedStock: 0,
    totalStoresCount: 0,
  })

  const [allInvoices, setAllInvoices] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [lowStockBags, setLowStockBags] = useState([])
  const [alertData, setAlertData] = useState(null)

  const [bestSellingBag, setBestSellingBag] = useState({ name: 'N/A', qty: 0 })
  const [caStats, setCaStats] = useState({
    breakdown: [],
    totalInvestment: 0,
    totalExpectedProfit: 0,
    totalSold: 0,
    totalRealizedProfit: 0,
  })

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

  const availableYears = Array.from({ length: 6 }, (_, index) =>
    String(new Date().getFullYear() - index),
  )

  const getYearMonthFromValue = (dateValue) => {
    if (!dateValue) return null

    const dateString = String(dateValue)
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
      }
    }

    const parsedDate = new Date(dateValue)
    if (Number.isNaN(parsedDate.getTime())) return null

    return {
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1,
    }
  }

  const matchesSelectedPeriod = (dateValue) => {
    const parsedDate = getYearMonthFromValue(dateValue)
    if (!parsedDate) return false

    return parsedDate.year === Number(selectedYear) && parsedDate.month === Number(selectedMonth)
  }

  const fetchDashboardData = async () => {
    try {
      // 1. Obtener Facturas / Ventas totales (Consulta limpia sin joins a malls)
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .order('date_billing', { ascending: false })

      if (invError) throw invError

      const periodInvoices = (invoices || []).filter((inv) =>
        matchesSelectedPeriod(inv.date_billing),
      )

      setAllInvoices(periodInvoices)
      setRecentInvoices(periodInvoices.slice(0, 5) || [])

      let totalSales = 0
      let totalCash = 0
      let totalTransfer = 0

      periodInvoices.forEach((inv) => {
        const amount = Number(inv.amount_total) || 0
        totalSales += amount

        const method = (inv.payment_method || '').toLowerCase()
        if (method === 'cash' || method === 'efectivo') {
          totalCash += amount
        } else {
          totalTransfer += amount
        }
      })

      // 2. Notas de entrega activas
      const activeDeliveriesCount = periodInvoices.length

      // 3. Inventario de bolsos
      const { data: bags, error: bagError } = await supabase.from('bags').select('*')

      if (bagError) throw bagError

      const activeBags = bags?.filter((b) => (b.status || '').toLowerCase() === 'active') || []
      const warehouseStock = activeBags.reduce(
        (acc, curr) => acc + Number(curr.warehouse_stock || 0),
        0,
      )
      const consignedStock = activeBags.reduce(
        (acc, curr) => acc + Number(curr.consigned_stock || 0),
        0,
      )

      const lowStock = activeBags.filter((b) => Number(b.warehouse_stock || 0) <= 5) || []
      setLowStockBags(lowStock)

      // 4. Conteo de tiendas (Sin consultar malls)
      const { count: storesCount } = await supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })

      setMetrics({
        totalSalesAmount: totalSales,
        totalCashSales: totalCash,
        totalTransferSales: totalTransfer,
        activeDeliveriesCount: activeDeliveriesCount || 0,
        totalWarehouseStock: warehouseStock,
        totalConsignedStock: consignedStock,
        totalStoresCount: storesCount || 0,
      })

      // 5. Calcular ventas generales y mapa de ventas por código
      const { data: deliveryDetails } = await supabase
        .from('delivery_details')
        .select('sold_quantity, delivery_notes(date_delivery), bags(model_name, code_bar)')

      let bestBag = { name: 'N/A', qty: 0 }
      const salesByCode = {}

      if (deliveryDetails) {
        const salesMap = {}
        deliveryDetails.forEach((d) => {
          const deliveryDate = d.delivery_notes?.date_delivery
          if (!matchesSelectedPeriod(deliveryDate)) return

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
      const caFiltered =
        bags?.filter((b) => {
          const code = (b.code_bar || '').toLowerCase().trim()
          const model = (b.model_name || '').toLowerCase().trim()
          return (
            code.startsWith('ca') ||
            code.includes('carla') ||
            model.startsWith('ca') ||
            model.includes('carla')
          )
        }) || []

      const caBreakdown = []
      let totalCAInv = 0
      let totalCAProfit = 0
      let totalCASold = 0
      let totalCARealizedProfit = 0

      caFiltered.forEach((b) => {
        const tStock =
          b.total_stock !== undefined && b.total_stock !== null
            ? Number(b.total_stock)
            : Number(b.warehouse_stock || 0) + Number(b.consigned_stock || 0)

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
          realizedProfit: realizedProfit,
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
        totalRealizedProfit: totalCARealizedProfit,
      })
    } catch (error) {
      setAlertData({ response: { message: error.message }, type: 'danger' })
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [selectedMonth, selectedYear])

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

    const monthNames = [
      '',
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ]
    const monthInt = parseInt(selectedMonth, 10)
    const yearInt = parseInt(selectedYear, 10)
    const fileName = `Estadisticas_${monthNames[monthInt]}_${yearInt}.csv`

    const periodInvoices = (allInvoices || []).filter((inv) =>
      matchesSelectedPeriod(inv.date_billing),
    )

    exportSales = 0
    exportCash = 0
    exportTransfer = 0

    periodInvoices.forEach((inv) => {
      const amount = Number(inv.amount_total) || 0
      exportSales += amount
      const method = (inv.payment_method || '').toLowerCase()
      if (method === 'cash' || method === 'efectivo') {
        exportCash += amount
      } else {
        exportTransfer += amount
      }
    })

    const rows = [
      ['Métrica', 'Valor'],
      ['Facturación Total (COP)', exportSales.toFixed(2)],
      ['Facturación Efectivo (COP)', exportCash.toFixed(2)],
      ['Facturación Transferencia (COP)', exportTransfer.toFixed(2)],
      ['Notas de Entrega Activas', metrics.activeDeliveriesCount],
      ['Total Stock Almacén', metrics.totalWarehouseStock],
      ['Total Stock Consignado', metrics.totalConsignedStock],
      ['Locales Totales', metrics.totalStoresCount],
      ['Bolso Más Vendido (Modelo)', bestSellingBag.name],
      ['Bolso Más Vendido (Cantidad)', bestSellingBag.qty],
    ]

    const csvContent = rows.map((r) => r.join(';')).join('\n')
    downloadCSV(csvContent, fileName)
  }

  const exportCAStats = () => {
    const monthNames = [
      '',
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ]
    const monthInt = parseInt(selectedMonth, 10)
    const yearInt = parseInt(selectedYear, 10)
    const fileName = `Estadisticas_CA_Carla_${monthNames[monthInt]}_${yearInt}.csv`

    const rows = [
      [
        'Modelo',
        'Codigo de Barras',
        'Stock Actual',
        'Unidades Vendidas',
        'Inversion Actual (COP)',
        'Ganancia Proyectada (COP)',
        'Ganancia Realizada (COP)',
      ],
    ]
    caStats.breakdown.forEach((b) => {
      rows.push([
        b.model,
        b.code,
        b.stock,
        b.sold,
        b.investment.toFixed(2),
        b.expectedProfit.toFixed(2),
        b.realizedProfit.toFixed(2),
      ])
    })
    rows.push([])
    rows.push([
      'TOTALES',
      '',
      '',
      caStats.totalSold,
      caStats.totalInvestment.toFixed(2),
      caStats.totalExpectedProfit.toFixed(2),
      caStats.totalRealizedProfit.toFixed(2),
    ])

    const csvContent = rows.map((r) => r.join(';')).join('\n')
    downloadCSV(csvContent, fileName)
  }

  return (
    <div className="p-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <h3 className="mb-0">Panel de Estadísticas y Control</h3>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <CFormSelect
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="1">Enero</option>
            <option value="2">Febrero</option>
            <option value="3">Marzo</option>
            <option value="4">Abril</option>
            <option value="5">Mayo</option>
            <option value="6">Junio</option>
            <option value="7">Julio</option>
            <option value="8">Agosto</option>
            <option value="9">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </CFormSelect>

          <CFormSelect
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ width: 'auto', minWidth: '120px' }}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
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

      <CRow className="mb-4">
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
                <div className="text-value-lg">
                  {metrics.totalWarehouseStock} / {metrics.totalConsignedStock}
                </div>
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
                    <h4 className="mb-0 text-success">
                      COP {caStats.totalExpectedProfit.toFixed(2)}
                    </h4>
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
                    <CTableRow key="ca-empty-row">
                      <CTableDataCell colSpan={7} className="text-center text-muted py-3">
                        No hay registros de esta línea.
                      </CTableDataCell>
                    </CTableRow>
                  ) : (
                    caStats.breakdown.map((item, idx) => (
                      <CTableRow key={`${item.code || 'item'}-${idx}`}>
                        <CTableDataCell className="fw-semibold">{item.model}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="secondary">{item.code}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell className="text-center">{item.stock}</CTableDataCell>
                        <CTableDataCell className="text-center fw-bold text-primary">
                          {item.sold}
                        </CTableDataCell>
                        <CTableDataCell className="text-end text-danger">
                          COP {item.investment.toFixed(2)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end text-success">
                          COP {item.expectedProfit.toFixed(2)}
                        </CTableDataCell>
                        <CTableDataCell className="text-end text-info fw-bold">
                          COP {item.realizedProfit.toFixed(2)}
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

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
                  {recentInvoices.map((inv, idx) => (
                    <CTableRow key={inv.invoice_id ? `${inv.invoice_id}-${idx}` : idx}>
                      <CTableDataCell>#{inv.invoice_id}</CTableDataCell>
                      <CTableDataCell>
                        {new Date(inv.date_billing).toLocaleDateString()}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={inv.payment_method === 'Cash' ? 'success' : 'info'}>
                          {inv.payment_method}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="fw-semibold">
                        COP {Number(inv.amount_total).toFixed(2)}
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                  {recentInvoices.length === 0 && (
                    <CTableRow key="recent-invoices-empty-row">
                      <CTableDataCell colSpan={4} className="text-center text-muted">
                        No hay facturas recientes
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={6} className="mb-4">
          <CCard className="h-100 shadow-sm border-0">
            <CCardHeader className="text-danger fw-semibold bg-light">
              Alertas: Stock Bajo en Almacén (≤ 5)
            </CCardHeader>
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
                  {lowStockBags.map((bag, idx) => (
                    <CTableRow key={bag.bag_id ? `${bag.bag_id}-${idx}` : idx}>
                      <CTableDataCell>{bag.model_name}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color="danger" shape="rounded-pill">
                          {bag.warehouse_stock}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{bag.consigned_stock}</CTableDataCell>
                    </CTableRow>
                  ))}
                  {lowStockBags.length === 0 && (
                    <CTableRow key="low-stock-empty-row">
                      <CTableDataCell colSpan={3} className="text-center text-muted">
                        No hay productos con stock bajo
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

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