import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './Cooking.css';

function Cooking() {
    const [recipes, setRecipes] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        document.title = 'Jackson Bryan: Cooking';
    }, []);

    useEffect(() => {
        let cancelled = false;

        supabase
            .from('recipes')
            .select('*')
            .order('sort_order', { ascending: true })
            .then(({ data, error: fetchError }) => {
                if (cancelled) return;
                if (fetchError) throw fetchError;
                setRecipes(data);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div id="cooking-page">
            <header>
                <h1>Cooking</h1>
            </header>

            <main>
                {error && <p className="status-note">Couldn't load recipes right now.</p>}
                {!error && !recipes && <p className="status-note">Loading recipes&hellip;</p>}

                {recipes && (
                    <div className="retro-box">
                        <table id="recipes">
                            <thead>
                                <tr>
                                    <th>Recipe</th>
                                    <th>Prep Time</th>
                                    <th>Cook Time</th>
                                    <th>Total Time</th>
                                </tr>
                            </thead>

                            <tbody>
                                {recipes.map((recipe) => (
                                    <tr key={recipe.id}>
                                        <td>
                                            <a href={recipe.url} target="_blank" rel="noopener noreferrer">
                                                {recipe.name}
                                            </a>
                                        </td>
                                        <td>{recipe.prep_time}</td>
                                        <td>{recipe.cook_time}</td>
                                        <td>{recipe.total_time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Cooking;
