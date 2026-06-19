import { Routes, Route } from 'react-router-dom'
import AdminLayout from '@/app/admin/layout'

import HomePage from '@/app/page'
import DynamicPage from '@/app/[slug]/page'
import ProductosPage from '@/app/productos/page'
import ProductDetailPage from '@/app/productos/[slug]/page'
import BlogPage from '@/app/blog/page'
import BlogPostPage from '@/app/blog/[slug]/page'
import CheckoutPage from '@/app/checkout/page'
import ContactoPage from '@/app/contacto/page'
import TerminosPage from '@/app/terminos-y-condiciones/page'
import PrivacidadPage from '@/app/politica-de-privacidad/page'
import EnviosPage from '@/app/politica-de-envios-y-devoluciones/page'
import SobreNosotrosPage from '@/app/sobre-nosotros/page'

import FacturacionPage from '@/app/facturacion/page'
import DetalleFacturaPage from '@/app/facturacion/detalle/page'
import InventarioPage from '@/app/inventario/page'
import ControlAsistenciaPage from '@/app/control-asistencia/page'
import PreviewPage from '@/app/preview/[id]/page'
import LoginPage from '@/app/auth/login/page'

import AdminDashboard from '@/app/admin/page'
import AdminConfig from '@/app/admin/configuracion/page'
import AdminTema from '@/app/admin/tema/page'
import AdminNavegacion from '@/app/admin/navegacion/page'
import AdminFuncionalidades from '@/app/admin/funcionalidades/page'
import AdminProductos from '@/app/admin/productos/page'
import AdminProductEditor from '@/app/admin/productos/[id]/page'
import AdminCategorias from '@/app/admin/categorias/page'
import AdminMarcas from '@/app/admin/marcas/page'
import AdminPedidos from '@/app/admin/pedidos/page'
import AdminClientes from '@/app/admin/clientes/page'
import AdminCupones from '@/app/admin/cupones/page'
import AdminEnvios from '@/app/admin/envios/page'
import AdminPaginas from '@/app/admin/paginas/page'
import AdminPageEditor from '@/app/admin/paginas/[id]/page'
import AdminBlogPosts from '@/app/admin/blog/posts/page'
import AdminBlogPostEditor from '@/app/admin/blog/posts/[id]/page'
import AdminBlogConfig from '@/app/admin/blog/configuracion/page'
import AdminNewsletter from '@/app/admin/marketing/newsletter/page'
import AdminResenas from '@/app/admin/marketing/resenas/page'
import AdminUsuarios from '@/app/admin/usuarios/page'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/productos" element={<ProductosPage />} />
      <Route path="/productos/:slug" element={<ProductDetailPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/contacto" element={<ContactoPage />} />
      <Route path="/terminos-y-condiciones" element={<TerminosPage />} />
      <Route path="/politica-de-privacidad" element={<PrivacidadPage />} />
      <Route path="/politica-de-envios-y-devoluciones" element={<EnviosPage />} />
      <Route path="/sobre-nosotros" element={<SobreNosotrosPage />} />
      <Route path="/facturacion" element={<FacturacionPage />} />
      <Route path="/facturacion/detalle" element={<DetalleFacturaPage />} />
      <Route path="/inventario" element={<InventarioPage />} />
      <Route path="/control-asistencia" element={<ControlAsistenciaPage />} />
      <Route path="/preview/:id" element={<PreviewPage />} />
      <Route path="/auth/login" element={<LoginPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="configuracion" element={<AdminConfig />} />
        <Route path="tema" element={<AdminTema />} />
        <Route path="navegacion" element={<AdminNavegacion />} />
        <Route path="funcionalidades" element={<AdminFuncionalidades />} />
        <Route path="productos" element={<AdminProductos />} />
        <Route path="productos/:id" element={<AdminProductEditor />} />
        <Route path="categorias" element={<AdminCategorias />} />
        <Route path="marcas" element={<AdminMarcas />} />
        <Route path="pedidos" element={<AdminPedidos />} />
        <Route path="clientes" element={<AdminClientes />} />
        <Route path="cupones" element={<AdminCupones />} />
        <Route path="envios" element={<AdminEnvios />} />
        <Route path="paginas" element={<AdminPaginas />} />
        <Route path="paginas/:id" element={<AdminPageEditor />} />
        <Route path="blog/posts" element={<AdminBlogPosts />} />
        <Route path="blog/posts/:id" element={<AdminBlogPostEditor />} />
        <Route path="blog/configuracion" element={<AdminBlogConfig />} />
        <Route path="marketing/newsletter" element={<AdminNewsletter />} />
        <Route path="marketing/resenas" element={<AdminResenas />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
      </Route>

      <Route path=":slug" element={<DynamicPage />} />
    </Routes>
  )
}
