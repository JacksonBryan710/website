import './App.css'
import Home from './pages/Home/Home'
import Cooking from './pages/Cooking/Cooking'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/cooking' element={<Cooking />} />
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App