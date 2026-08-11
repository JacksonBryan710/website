import { useEffect } from 'react';
import { useSupabaseQuery } from '../../lib/useSupabaseQuery';
import RetroPanel from '../../components/RetroPanel/RetroPanel';
import './Cooking.css';

function Cooking() {
    useEffect(() => {
        document.title = 'Jackson Bryan: Cooking';
    }, []);

    const { data: recipes, error } = useSupabaseQuery(
        (supabase) => supabase.from('recipes').select('*').order('sort_order', { ascending: true }),
        [],
    );

    return (
        <div id="cooking-page" className="page">
            <header>
                <h1 className="page-title">Cooking</h1>
            </header>

            <main>
                {error && <p className="status-note">Couldn't load recipes right now.</p>}
                {!error && !recipes && <p className="status-note">Loading recipes&hellip;</p>}

                {recipes && (
                    <RetroPanel title="Recipes">
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
                    </RetroPanel>
                )}
            </main>
        </div>
    );
}

export default Cooking;
