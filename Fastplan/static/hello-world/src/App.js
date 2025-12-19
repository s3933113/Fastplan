import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

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
    flexDirection: 'column',
    position: 'relative'
};

const settingsButtonStyle = {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: theme.primary,
    border: 'none',
    color: '#FFFFFF',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s'
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
};

const modalStyle = {
    background: theme.white,
    borderRadius: '12px',
    padding: '30px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    position: 'relative'
};

const selectStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '4px',
    border: `2px solid ${theme.border}`,
    fontSize: '14px',
    marginTop: '10px',
    cursor: 'pointer'
};

const loadingOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    flexDirection: 'column'
};

const loadingModalStyle = {
    background: theme.white,
    borderRadius: '12px',
    padding: '40px',
    minWidth: '300px',
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
};

// Spinner component with CSS animation (using external CSS file to avoid CSP issues)
const Spinner = () => {
    return (
        <div
            style={{
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #0052CC',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                margin: '0 auto 20px',
                animation: 'spinner-rotate 1s linear infinite'
            }}
        />
    );
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
    const [showSettings, setShowSettings] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gpt-4o-mini'); // Default model
    const [complexity, setComplexity] = useState('MVP'); // Default complexity
    
    // Available GPT models
    const availableModels = [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cost-Effective)' },
        { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (High Quality)' },
        { value: 'gpt-4', label: 'GPT-4 (Standard)' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy)' }
    ];
    
    // Complexity options
    const complexityOptions = [
        { value: 'MVP', label: 'MVP - Core Features Only' },
        { value: 'Standard', label: 'Standard - Full Product' },
        { value: 'Enterprise', label: 'Enterprise - Scalable & Secure' }
    ];

    // Selection handler function (allows independent selection)
    const toggle = (id) => {
        setSelected(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true); setMessage(null); setPlan(null);
        try {
            const result = await invoke('generatePlan', { prompt, model: selectedModel, complexity });
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
            {/* Loading Popup */}
            {loading && (
                <div style={loadingOverlayStyle}>
                    <div style={loadingModalStyle}>
                        <Spinner />
                        <h3 style={{ color: theme.primary, marginTop: 0, marginBottom: '10px' }}>
                            AI is drafting the plan...
                        </h3>
                        <p style={{ color: theme.text, fontSize: '14px', margin: 0, opacity: 0.7 }}>
                            Please wait while we generate your project plan
                        </p>
                    </div>
                </div>
            )}
            
            <div style={mainCardStyle}>
                <button 
                    style={settingsButtonStyle}
                    onClick={() => setShowSettings(true)}
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#0052CC'; // Darker blue on hover
                        e.target.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = theme.primary;
                        e.target.style.opacity = '1';
                    }}
                >
                    ⚙️ Settings Agent
                </button>
                
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
                
                <label style={{ color: theme.text, fontWeight: '600', display: 'block', marginBottom: '8px', marginTop: '10px' }}>
                    Project Complexity:
                </label>
                <select
                    style={selectStyle}
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value)}
                >
                    {complexityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                
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

            {/* Settings Modal */}
            {showSettings && (
                <div style={modalOverlayStyle} onClick={() => setShowSettings(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <button
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: theme.text,
                                fontWeight: 'bold'
                            }}
                            onClick={() => setShowSettings(false)}
                        >
                            ×
                        </button>
                        
                        <h3 style={{ color: theme.primary, marginTop: 0, marginBottom: '20px' }}>
                            Agent Settings
                        </h3>
                        
                        <label style={{ color: theme.text, fontWeight: '600', display: 'block' }}>
                            Select GPT Model:
                        </label>
                        
                        <select
                            style={selectStyle}
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                        >
                            {availableModels.map((model) => (
                                <option key={model.value} value={model.value}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                        
                        <p style={{ color: theme.text, fontSize: '12px', marginTop: '15px', opacity: 0.7 }}>
                            Current selection: <strong>{selectedModel}</strong>
                        </p>
                        
                        <button
                            style={{
                                ...btnStyle,
                                width: '100%',
                                marginTop: '20px',
                                backgroundColor: theme.primary,
                                color: '#FFFFFF'
                            }}
                            onClick={() => setShowSettings(false)}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
