import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import FlashScreen from './pages/FlashScreen'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
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
import TagsPage from './pages/TagsPage'
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
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/products" element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        } />
        
        <Route path="/add-product" element={
          <ProtectedRoute>
            <AddProduct />
          </ProtectedRoute>
        } />
        
        <Route path="/edit-product/:id" element={
          <ProtectedRoute>
            <EditProduct />
          </ProtectedRoute>
        } />
        
        <Route path="/compare" element={
          <ProtectedRoute>
            <Compare />
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        } />
        
        <Route path="/nomenclature" element={
          <ProtectedRoute>
            <NomenclatureMap />
          </ProtectedRoute>
        } />
        
        <Route path="/add-coa" element={
          <ProtectedRoute>
            <AddCOA />
          </ProtectedRoute>
        } />
        
        <Route path="/coa" element={
          <ProtectedRoute>
            <COA />
          </ProtectedRoute>
        } />
        
        <Route path="/formulation" element={
          <ProtectedRoute>
            <Formulation />
          </ProtectedRoute>
        } />
        
        <Route path="/tags" element={
          <ProtectedRoute>
            <TagsPage />
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

