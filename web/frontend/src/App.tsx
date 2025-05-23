import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SingleImagePage from './pages/SingleImagePage'
import MultiImagePage from './pages/MultiImagePage'
import VideoPage from './pages/VideoPage'
import MultiVideoPage from './pages/MultiVideoPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/single-image" element={<SingleImagePage />} />
          <Route path="/multi-image" element={<MultiImagePage />} />
          <Route path="/video" element={<VideoPage />} />
          <Route path="/multi-video" element={<MultiVideoPage />} />
        </Routes>
      </Layout>
    </div>
  )
}

export default App 