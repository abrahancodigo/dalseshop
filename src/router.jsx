import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'

const AdminLayout = lazy(() => import('@/app/admin/layout'))

const HomePage = lazy(() => import('@/app/page'))
const DynamicPage = lazy(() => import('@/app/[slug]/page'))
const ProductosPage = lazy(() => import('@/app/productos/page'))
const ProductDetailPage = lazy(() => import('@/app/productos/[slug]/page'))
const BlogPage = lazy(() => import('@/app/blog/page'))
const BlogPostPage = lazy(() => import('@/app/blog/[slug]/page'))
const CheckoutPage = lazy(() => import('@/app/checkout/page'))
const ContactoPage = lazy(() => import('@/app/contacto/page'))
const TerminosPage = lazy(() => import('@/app/terminos-y-condiciones/page'))
const PrivacidadPage = lazy(() => import('@/app/politica-de-privacidad/page'))
const EnviosPage = lazy(() => import('@/app/politica-de-envios-y-devoluciones/page'))
const SobreNosotrosPage = lazy(() => import('@/app/sobre-nosotros/page'))

const FacturacionPage = lazy(() => import('@/app/facturacion/page'))
const DetalleFacturaPage = lazy(() => import('@/app/facturacion/detalle/page'))
const InventarioPage = lazy(() => import('@/app/inventario/page'))
const ControlAsistenciaPage = lazy(() => import('@/app/control-asistencia/page'))
const EstudioMercadoPage = lazy(() => import('@/app/estudio-mercado/page'))
const PreviewPage = lazy(() => import('@/app/preview/[id]/page'))
const LoginPage = lazy(() => import('@/app/auth/login/page'))

const AdminDashboard = lazy(() => import('@/app/admin/page'))
const AdminConfig = lazy(() => import('@/app/admin/configuracion/page'))
const AdminTema = lazy(() => import('@/app/admin/tema/page'))
const AdminNavegacion = lazy(() => import('@/app/admin/navegacion/page'))
const AdminFuncionalidades = lazy(() => import('@/app/admin/funcionalidades/page'))
const AdminProductos = lazy(() => import('@/app/admin/productos/page'))
const AdminProductEditor = lazy(() => import('@/app/admin/productos/[id]/page'))
const AdminCategorias = lazy(() => import('@/app/admin/categorias/page'))
const AdminMarcas = lazy(() => import('@/app/admin/marcas/page'))
const AdminPedidos = lazy(() => import('@/app/admin/pedidos/page'))
const AdminClientes = lazy(() => import('@/app/admin/clientes/page'))
const AdminCupones = lazy(() => import('@/app/admin/cupones/page'))
const AdminEnvios = lazy(() => import('@/app/admin/envios/page'))
const AdminPaginas = lazy(() => import('@/app/admin/paginas/page'))
const AdminPageEditor = lazy(() => import('@/app/admin/paginas/[id]/page'))
const AdminBlogPosts = lazy(() => import('@/app/admin/blog/posts/page'))
const AdminBlogPostEditor = lazy(() => import('@/app/admin/blog/posts/[id]/page'))
const AdminBlogConfig = lazy(() => import('@/app/admin/blog/configuracion/page'))
const AdminNewsletter = lazy(() => import('@/app/admin/marketing/newsletter/page'))
const AdminResenas = lazy(() => import('@/app/admin/marketing/resenas/page'))
const AdminUsuarios = lazy(() => import('@/app/admin/usuarios/page'))

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
      <Route path="/estudio-mercado" element={<EstudioMercadoPage />} />
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
