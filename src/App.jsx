import './App.css'
import Layout from './components/Layout/Layout'
import About from './pages/About/About'
import Now from './pages/Now/Now'
import Projects from './pages/Projects/Projects'
import Cooking from './pages/Cooking/Cooking'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path='/' element={<Navigate to='/about' replace />} />
                        <Route path='/about' element={<About />} />
                        <Route path='/now' element={<Now />} />
                        <Route path='/projects' element={<Projects />} />
                        <Route path='/cooking' element={<Cooking />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App