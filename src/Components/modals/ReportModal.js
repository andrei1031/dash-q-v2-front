import { useState } from "react";
import { supabase } from "../supabase";
import { API_URL } from "../http-commons";
import { IconCamera } from "../assets/Icon";
import axios from "axios";

export const ReportModal = ({ isOpen, onClose, reporterId, reportedId, userRole, onSubmit }) => {
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
            // 1. Upload Proof if selected
            if (selectedFile) {
                setIsUploading(true);
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `proofs/${reporterId}-${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('report_proofs') // Make sure this bucket exists!
                    .upload(filePath, selectedFile);
                
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('report_proofs').getPublicUrl(filePath);
                proofImageUrl = data.publicUrl;
                setIsUploading(false);
            }

            // 2. Submit Report
            await axios.post(`${API_URL}/reports`, {
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
            console.error(err);
            alert("Failed to submit report. " + (err.message || ''));
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
                    <p>Submit a report to the Admin.</p>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Reason:</label>
                            <select value={reason} onChange={e => setReason(e.target.value)}>
                                <option>Rude Behavior</option>
                                <option>No-Show / Late</option>
                                <option>Inappropriate Language</option>
                                <option>Scam / Spam</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Details:</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required placeholder="Describe what happened..." />
                        </div>
                        
                        {/* --- NEW: Screenshot Upload --- */}
                        <div className="form-group photo-upload-group">
                            <label>Attach Screenshot (Optional):</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} id="report-proof-upload" className="file-upload-input" />
                            <label htmlFor="report-proof-upload" className="btn btn-secondary btn-icon-label file-upload-label">
                                <IconCamera /> {selectedFile ? selectedFile.name : 'Choose Image...'}
                            </label>
                        </div>
                        {/* ----------------------------- */}

                        <div className="modal-footer">
                            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                            <button type="submit" disabled={loading || isUploading} className="btn btn-danger">
                                {/* OLD: {loading || isUploading ? <Spinner /> : 'Submit Report'} */}
                                {/* NEW: Static Text */}
                                Submit Report
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
