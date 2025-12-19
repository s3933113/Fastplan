import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

// === Styles (Atlassian Brand Theme) ===
const theme = {
    bg: '#0C66E4',      // Brand Blue Background
    primary: '#0C66E4', 
    text: '#172B4D',    // Dark Blue Text
    white: '#FFFFFF',
    border: '#DFE1E6'
};

const containerStyle = { 
    padding: '60px 20px', 
    color: '#FFFFFF', 
    backgroundColor: theme.bg,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

const mainCardStyle = {
    background: theme.white,
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '650px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    marginBottom: '40px',
    display: 'flex',
    flexDirection: 'column'
};

const boxStyle = { 
    background: theme.white, 
    border: `1px solid ${theme.border}`, 
    borderRadius: '8px', 
    padding: '20px', 
    marginBottom: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    color: theme.text,
    width: '100%',
    maxWidth: '650px'
};

const inputStyle = { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '4px', 
    border: `2px solid ${theme.border}`, 
    marginBottom: '15px',
    fontSize: '14px'
};

const btnStyle = { 
    background: theme.primary, 
    color: 'white', 
    border: 'none', 
    padding: '12px 24px', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontWeight: '600',
    fontSize: '14px',
    transition: 'background 0.2s'
};

const createBtnStyle = { 
    ...btnStyle, 
    background: '#1F845A', // Jira Green
    width: '100%', 
    fontSize: '16px', 
    marginTop: '25px',
    padding: '16px'
};

function App() {
    const [prompt, setPrompt] = useState('');
    const [plan, setPlan] = useState(null);
    const [selected, setSelected] = useState({}); // Store selection status { 'epic': true, 's0': true, 's0t0': true }
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [message, setMessage] = useState(null);
    const [isHovered, setIsHovered] = useState(false);

    // Selection handler function (allows independent selection)
    const toggle = (id) => {
        setSelected(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true); setMessage(null); setPlan(null);
        try {
            const result = await invoke('generatePlan', { prompt });
            setPlan(result);
            
            // Initial state: Select all items by default, user can deselect as needed
            const initial = { 'epic': true };
            result.epic.stories.forEach((s, sIdx) => {
                initial[`s${sIdx}`] = true;
                s.subtasks.forEach((_, tIdx) => { initial[`s${sIdx}t${tIdx}`] = true; });
            });
            setSelected(initial);
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setLoading(false); }
    };

    const handleCreate = async () => {
        setCreating(true); setMessage(null);
        try {
            // Filter data based on "selected" items
            const filteredStories = [];
            plan.epic.stories.forEach((s, sIdx) => {
                const storyId = `s${sIdx}`;
                const selectedTasks = s.subtasks.filter((_, tIdx) => selected[`s${sIdx}t${tIdx}`]);
                
                // If Story is selected or at least one sub-task is selected, include this story for creation
                if (selected[storyId] || selectedTasks.length > 0) {
                    filteredStories.push({ ...s, subtasks: selectedTasks });
                }
            });

            const payload = {
                epic: selected['epic'] ? { title: plan.epic.title, description: plan.epic.description } : null,
                stories: filteredStories
            };

            if (!payload.epic && filteredStories.length === 0) throw new Error('Please select at least one item to create');

            const result = await invoke('createIssues', { plan: payload });
            setMessage({ type: 'success', text: result.message });
            setPlan(null); 
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setCreating(false); }
    };

    return (
        <div style={containerStyle}>
            <div style={mainCardStyle}>
                <h2 style={{ color: theme.primary, fontWeight: 'bold', marginTop: 0, marginBottom: '15px' }}>
                    Jira FastPlan Project
                </h2>
                <p style={{ color: theme.text, opacity: 0.9, marginBottom: '25px', fontSize: '15px' }}>
                    Type the project you want, AI will help draft a plan for you to choose.
                </p>
                
                <textarea 
                    style={inputStyle} 
                    rows="3" 
                    placeholder="Example: Library Management System, Food Delivery App..." 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                />
                
                <button 
                    style={{
                        ...btnStyle,
                        backgroundColor: '#FFFFFF',
                        color: '#0C66E4',
                        fontWeight: 'bold',
                        border: `2px solid ${theme.primary}`,
                        marginTop: '10px'
                    }} 
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleGenerate} 
                    disabled={loading}
                >
                    {loading ? ' AI is drafting the plan...' : 'Generate Plan'}
                </button>
            </div>

            {plan && (
                <div style={{ width: '100%', maxWidth: '650px' }}>
                    <h3 style={{ borderBottom: `2px solid #FFFFFF`, paddingBottom: '10px', color: '#FFFFFF', marginBottom: '20px' }}>
                        Review and Select Items
                    </h3>
                    
                    {/* EPIC SECTION */}
                    <div style={{ ...boxStyle, borderLeft: '6px solid #ffab00' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                            <input 
                                type="checkbox" 
                                style={{ width: '20px', height: '20px', marginRight: '10px' }}
                                checked={!!selected['epic']} 
                                onChange={() => toggle('epic')} 
                            />
                             EPIC: {plan.epic.title}
                        </label>
                    </div>

                    {/* STORIES SECTION */}
                    {plan.epic.stories.map((story, sIdx) => (
                        <div key={sIdx} style={{ width: '100%' }}>
                            <div style={{ ...boxStyle, borderLeft: '6px solid #36b37e', marginLeft: 0 }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        style={{ width: '18px', height: '18px', marginRight: '10px' }}
                                        checked={!!selected[`s${sIdx}`]} 
                                        onChange={() => toggle(`s${sIdx}`)} 
                                    />
                                     Story: {story.title}
                                </label>

                                {/* SUB-TASKS SECTION */}
                                <div style={{ marginTop: '10px', marginLeft: '30px' }}>
                                    {story.subtasks.map((task, tIdx) => (
                                        <label key={tIdx} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '8px', fontSize: '14px' }}>
                                            <input 
                                                type="checkbox" 
                                                style={{ marginRight: '10px' }}
                                                checked={!!selected[`s${sIdx}t${tIdx}`]} 
                                                onChange={() => toggle(`s${sIdx}t${tIdx}`)} 
                                            />
                                             Task: {task.title}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}

                    <button style={createBtnStyle} onClick={handleCreate} disabled={creating}>
                        {creating ? 'Creating in Jira...' : 'Confirm and Create Selected Items to Jira Backlog'}
                    </button>
                </div>
            )}

            {message && (
                <div style={{ 
                    marginTop: '20px', 
                    padding: '15px', 
                    borderRadius: '3px', 
                    background: message.type === 'error' ? '#ffebe6' : '#e3fcef',
                    color: message.type === 'error' ? '#bf2600' : '#006644',
                    border: `1px solid ${message.type === 'error' ? '#ffbdad' : '#abf5d1'}`,
                    textAlign: 'center',
                    fontWeight: 'bold'
                }}>
                    {message.text}
                </div>
            )}
        </div>
    );
}

export default App;
