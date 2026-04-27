import { useState } from "react";
import { supabase } from "../supabase";
import { IconCamera } from "../assets/Icon";
import apiClient from "../http-commons"; // Use your configured apiClient

export const ReportModal = ({ isOpen, onClose, reporterId, reportedId, userRole }) => {
    const [reason, setReason] = useState('Rude Behavior');
    const [description, setDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    
    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        let proofImageUrl = null;

        try {
            // 1. Upload Proof to Supabase Storage if a file is selected
            if (selectedFile) {
                setIsUploading(true);
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `proofs/${reporterId}-${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('report_proofs') // Ensure this bucket exists in your Supabase project
                    .upload(filePath, selectedFile);
                
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('report_proofs').getPublicUrl(filePath);
                proofImageUrl = data.publicUrl;
                setIsUploading(false);
            }

            // 2. Submit Report to Backend
            // NOTE: We use '/reports' because the apiClient usually handles the '/api' prefix
            // This matches the backend mount: app.use('/api/reports', reportsRoutes)
            await apiClient.post('/reports', {
                reporterId,
                reportedId,
                role: userRole,
                reason,
                description,
                proofImageUrl
            });

            alert("Report submitted successfully.");
            onClose();
        } catch (err) {
            console.error("Report submission error:", err);
            const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
            alert("Failed to submit report: " + errorMessage);
        } finally {
            setLoading(false);
            setIsUploading(false);
            setSelectedFile(null);
            setDescription('');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-body">
                    <h2 style={{color: 'var(--error-color)'}}>⚠️ Report User</h2>
                    <p>Submit a report to the shop administrator.</p>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Reason for Report:</label>
                            <select 
                                value={reason} 
                                onChange={e => setReason(e.target.value)}
                                className="form-control"
                            >
                                <option value="Rude Behavior">Rude Behavior</option>
                                <option value="No-Show / Late">No-Show / Late</option>
                                <option value="Inappropriate Language">Inappropriate Language</option>
                                <option value="Scam / Spam">Scam / Spam</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Detailed Description:</label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                required 
                                placeholder="Please describe exactly what happened..."
                                className="form-control"
                                style={{ minHeight: '100px' }}
                            />
                        </div>
                        
                        <div className="form-group photo-upload-group">
                            <label>Attach Screenshot / Proof (Optional):</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                id="report-proof-upload" 
                                className="file-upload-input" 
                            />
                            <label htmlFor="report-proof-upload" className="btn btn-secondary btn-icon-label file-upload-label">
                                <IconCamera /> {selectedFile ? selectedFile.name : 'Choose Image...'}
                            </label>
                        </div>

                        <div className="modal-footer">
                            <button type="button" onClick={onClose} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading || isUploading} 
                                className="btn btn-danger"
                            >
                                {loading ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};