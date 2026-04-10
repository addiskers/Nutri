import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionGuard from './components/PermissionGuard'
import FlashScreen from './pages/FlashScreen'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import AddProduct from './pages/AddProduct'
import EditProduct from './pages/EditProduct'
import Compare from './pages/Compare'
import Users from './pages/Users'
import AddCOA from './pages/AddCOA'
import COA from './pages/COA'
import Formulation from './pages/Formulation'
import NomenclatureMap from './pages/NomenclatureMap'
import COANomenclatureMap from './pages/COANomenclatureMap'
import NutrientHierarchyMap from './pages/NutrientHierarchyMap'

import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FlashScreen />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <PermissionGuard permission="view_analytics" pageName="Dashboard" redirectToDashboard={false}>
              <Dashboard />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/products" element={
          <ProtectedRoute>
            <PermissionGuard permission="view_products" pageName="Products">
              <Products />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/add-product" element={
          <ProtectedRoute>
            <PermissionGuard permission="add_products" pageName="Add Product">
              <AddProduct />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/edit-product/:id" element={
          <ProtectedRoute>
            <PermissionGuard permission="edit_products" pageName="Edit Product">
              <EditProduct />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/compare" element={
          <ProtectedRoute>
            <PermissionGuard permission="run_comparisons" pageName="Compare">
              <Compare />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute>
            <PermissionGuard permission="view_users" pageName="Users">
              <Users />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/nomenclature" element={
          <ProtectedRoute>
            <PermissionGuard permission="view_nomenclature" pageName="Nomenclature Map">
              <NomenclatureMap />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/add-coa" element={
          <ProtectedRoute>
            <PermissionGuard permission="add_coa" pageName="Add COA">
              <AddCOA />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/coa" element={
          <ProtectedRoute>
            <PermissionGuard permission="view_coa" pageName="COA">
              <COA />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/formulation" element={
          <ProtectedRoute>
            <PermissionGuard permission="use_coa_in_formulation" pageName="Formulation">
              <Formulation />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/coa-nomenclature" element={
          <ProtectedRoute>
            <PermissionGuard permission="edit_nomenclature" pageName="COA Nomenclature">
              <COANomenclatureMap />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/nutrient-hierarchy" element={
          <ProtectedRoute>
            <PermissionGuard permission="edit_nomenclature" pageName="Nutrient Hierarchy">
              <NutrientHierarchyMap />
            </PermissionGuard>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/categories" element={<Navigate to="/nomenclature" />} />
      </Routes>
    </Router>
  )
}

export default App

