import React from 'react'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Inventory = React.lazy(() => import('./views/Inventory/inventory'))
const Sales = React.lazy(() => import('./views/Sales/sales'))
const Profile = React.lazy(() => import('./views/Profile/profile'))
const Users = React.lazy(() => import('./views/Users/users'))
const Customers = React.lazy(() => import('./views/Customers/customers'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard, adminOnly: true },
  { path: '/inventory', name: 'Inventory', element: Inventory },
  { path: '/sales', name: 'Sales', element: Sales },
  { path: '/profile', name: 'Profile', element: Profile },
  { path: '/users', name: 'Users', element: Users, adminOnly: true },
  { path: '/customers', name: 'Customers', element: Customers },
]

export default routes