package com.chunter.pics;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.Gravity;
import android.view.MotionEvent;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.documentfile.provider.DocumentFile;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends AppCompatActivity {
    private static final Set<String> EXTENSIONS = new HashSet<>(Arrays.asList(".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif", ".heic", ".heif"));
    private final List<DocumentFile> photos = new ArrayList<>(), folders = new ArrayList<>();
    private int position = 0; private DocumentFile root, undoDestination; private String undoOriginalName; private ImageView image; private TextView status, fileLabel, countLabel; private LinearLayout targets; private FrameLayout stage; private float downX, downY; private boolean working;
    private final ActivityResultLauncher<Uri> folderPicker = registerForActivityResult(new ActivityResultContracts.OpenDocumentTree(), this::onFolderChosen);
    @Override protected void onCreate(Bundle state) { super.onCreate(state); buildScreen(); }
    private int dp(float x) { return (int)(x*getResources().getDisplayMetrics().density+.5f); }
    private TextView label(String text,float size,int color) { TextView v=new TextView(this); v.setText(text); v.setTextSize(size); v.setTextColor(color); return v; }
    private void buildScreen() {
        LinearLayout page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); page.setPadding(dp(18),dp(12),dp(18),dp(12)); page.setBackgroundColor(Color.rgb(245,242,233)); setContentView(page);
        TextView title=label("A-Pic Test",27,Color.rgb(20,65,58)); title.setGravity(Gravity.CENTER_VERTICAL); page.addView(title,new LinearLayout.LayoutParams(-1,dp(52)));
        TextView intro=label("Choose your test folder, then flick each picture toward its destination.",15,Color.DKGRAY); page.addView(intro,new LinearLayout.LayoutParams(-1,dp(52)));
        Button choose=new Button(this); choose.setText("Choose test folder"); choose.setOnClickListener(v->folderPicker.launch(null)); page.addView(choose,new LinearLayout.LayoutParams(-1,dp(52)));
        countLabel=label("Choose DCIM/__apictest to begin",15,Color.rgb(20,65,58)); page.addView(countLabel,new LinearLayout.LayoutParams(-1,dp(38)));
        stage=new FrameLayout(this); stage.setBackgroundColor(Color.rgb(226,232,220)); LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,0,1f); sp.setMargins(0,dp(4),0,dp(4)); page.addView(stage,sp);
        image=new ImageView(this); image.setBackgroundColor(Color.WHITE); image.setScaleType(ImageView.ScaleType.FIT_CENTER); FrameLayout.LayoutParams ip=new FrameLayout.LayoutParams(-1,-1); ip.setMargins(dp(35),dp(48),dp(35),dp(48)); stage.addView(image,ip);
        image.setOnTouchListener((v,e)->{ if(e.getAction()==MotionEvent.ACTION_DOWN){downX=e.getRawX();downY=e.getRawY();image.animate().cancel();image.setTranslationX(0);image.setTranslationY(0);return true;} if(e.getAction()==MotionEvent.ACTION_MOVE){image.setTranslationX((e.getRawX()-downX)*4f);image.setTranslationY((e.getRawY()-downY)*4f);return true;} if(e.getAction()==MotionEvent.ACTION_UP){float dx=e.getRawX()-downX,dy=e.getRawY()-downY;if(Math.hypot(dx,dy)>dp(24)){chooseDirection(dx,dy,e.getRawX());}else{image.animate().translationX(0).translationY(0).setDuration(130).start();}return true;} return true; });
        TextView hint=label("Flick toward a folder",13,Color.GRAY); hint.setGravity(Gravity.CENTER); stage.addView(hint,new FrameLayout.LayoutParams(-1,dp(34),Gravity.TOP));
        targets=new LinearLayout(this); targets.setGravity(Gravity.CENTER); targets.setPadding(0,dp(4),0,dp(4)); page.addView(targets,new LinearLayout.LayoutParams(-1,dp(66)));
        fileLabel=label("No picture selected",14,Color.DKGRAY); fileLabel.setGravity(Gravity.CENTER); page.addView(fileLabel,new LinearLayout.LayoutParams(-1,dp(34)));
        status=label("Your photos stay on this phone.",14,Color.rgb(20,65,58)); status.setGravity(Gravity.CENTER); page.addView(status,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout actions=new LinearLayout(this); actions.setGravity(Gravity.CENTER); Button skip=new Button(this); skip.setText("Skip"); skip.setOnClickListener(v->{if(position<photos.size())position++;showCurrent();}); Button undo=new Button(this); undo.setText("Undo last move"); undo.setOnClickListener(v->undoMove()); actions.addView(skip);actions.addView(undo);page.addView(actions);
    }
    private void onFolderChosen(Uri uri) {
        if(uri==null){status.setText("No folder selected.");return;} int flags=Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        try{getContentResolver().takePersistableUriPermission(uri,flags);}catch(SecurityException ex){status.setText("Android did not grant read/write access. Choose the folder again.");return;}
        root=DocumentFile.fromTreeUri(this,uri); if(root==null||!root.canRead()||!root.canWrite()){status.setText("Folder permission is missing. Choose it again and allow access.");return;} scan();
    }
    private void scan(){photos.clear();folders.clear();position=0;undoDestination=null;DocumentFile[] children=root.listFiles();for(DocumentFile f:children){if(f.isDirectory())folders.add(f);else if(f.isFile()&&isPicture(f.getName()))photos.add(f);}folders.sort(Comparator.comparing(DocumentFile::getName,String.CASE_INSENSITIVE_ORDER));photos.sort(Comparator.comparing(DocumentFile::getName,String.CASE_INSENSITIVE_ORDER));renderTargets();countLabel.setText(photos.size()+" pictures found in "+(root.getName()==null?"selected folder":root.getName()));if(photos.isEmpty()){image.setImageDrawable(null);fileLabel.setText("No pictures in this folder");status.setText("Choose DCIM/__apictest itself. Put the JPGs beside folders 1–5.");}else{status.setText("Folder access granted. Found "+photos.size()+" pictures and "+folders.size()+" folders.");showCurrent();}}
    private boolean isPicture(String name){if(name==null)return false;String n=name.toLowerCase(Locale.ROOT);for(String e:EXTENSIONS)if(n.endsWith(e))return true;return false;}
    private void renderTargets(){targets.removeAllViews();if(folders.isEmpty()){targets.addView(label("Add destination folders inside the selected folder",14,Color.DKGRAY));return;}for(int i=0;i<folders.size();i++){final int ix=i;String name=folders.get(i).getName();Button b=new Button(this);b.setText(name==null?"Folder":name);b.setAllCaps(false);b.setTextSize(12);b.setMinWidth(0);b.setPadding(dp(5),0,dp(5),0);b.setOnClickListener(v->moveTo(ix));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(54),1f);p.setMargins(dp(2),0,dp(2),0);targets.addView(b,p);}}
    private void showCurrent(){image.setTranslationX(0);image.setTranslationY(0);if(position>=photos.size()){image.setImageDrawable(null);fileLabel.setText("All pictures sorted or skipped");countLabel.setText("0 pictures remaining");status.setText("All pictures sorted or skipped.");return;}DocumentFile f=photos.get(position);fileLabel.setText(f.getName());countLabel.setText((position+1)+" of "+photos.size());try{Bitmap bitmap=decodePreview(f.getUri());if(bitmap==null)throw new Exception("Android returned no image data.");image.setImageBitmap(bitmap);status.setText("Preview loaded. Flick to a folder or tap its button.");}catch(Exception ex){image.setImageDrawable(null);status.setText("Can't preview "+f.getName()+" ("+ex.getClass().getSimpleName()+"): "+ex.getMessage());}}
    private Bitmap decodePreview(Uri uri)throws Exception{Exception modernError=null;if(Build.VERSION.SDK_INT>=28){try{ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{int w=info.getSize().getWidth(),h=info.getSize().getHeight();float scale=Math.min(1f,1600f/Math.max(w,h));if(scale<1f)decoder.setTargetSize(Math.max(1,(int)(w*scale)),Math.max(1,(int)(h*scale)));decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);});}catch(Exception ex){modernError=ex;}}try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new Exception("Android did not open the image stream.");BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeStream(in,null,bounds);int sample=1;while(bounds.outWidth/sample>1600||bounds.outHeight/sample>1600)sample*=2;BitmapFactory.Options opt=new BitmapFactory.Options();opt.inSampleSize=sample;try(InputStream preview=getContentResolver().openInputStream(uri)){Bitmap bitmap=BitmapFactory.decodeStream(preview,null,opt);if(bitmap==null)throw new Exception("Android's bitmap decoder rejected this file.");return bitmap;}}catch(Exception fallback){if(modernError!=null)throw new Exception("ImageDecoder: "+modernError.getMessage()+"; bitmap fallback: "+fallback.getMessage(),fallback);throw fallback;}}
    private byte[] readBytes(InputStream in)throws Exception{java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return out.toByteArray();}
    private void chooseDirection(float dx,float dy,float releaseX){if(folders.isEmpty()){status.setText("There are no destination folders." );return;}int[] loc=new int[2];targets.getLocationOnScreen(loc);float fraction=(releaseX-loc[0])/(float)Math.max(1,targets.getWidth());int ix=Math.max(0,Math.min(folders.size()-1,(int)(fraction*folders.size())));moveTo(ix);}
    private String uniqueName(DocumentFile dir,String name){if(dir.findFile(name)==null)return name;int dot=name.lastIndexOf('.');String base=dot>0?name.substring(0,dot):name,ext=dot>0?name.substring(dot):"";int n=2;while(dir.findFile(base+" ("+n+")"+ext)!=null)n++;return base+" ("+n+")"+ext;}
    private void moveTo(int ix){if(working||position>=photos.size()||ix<0||ix>=folders.size())return;working=true;DocumentFile src=photos.get(position),dest=folders.get(ix);String srcName=src.getName();status.setText("Moving "+srcName+" to "+dest.getName()+"…");new Thread(()->{String msg;DocumentFile copied=null;try{copied=dest.createFile(getContentResolver().getType(src.getUri())==null?"application/octet-stream":getContentResolver().getType(src.getUri()),uniqueName(dest,srcName));if(copied==null)throw new Exception("Android could not create the destination file.");try(InputStream in=new BufferedInputStream(getContentResolver().openInputStream(src.getUri()));OutputStream out=new BufferedOutputStream(getContentResolver().openOutputStream(copied.getUri(),"w"))){if(in==null||out==null)throw new Exception("Could not open source or destination.");byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);out.flush();}if(!src.delete())throw new Exception("Copied it, but Android refused to delete original. Recheck folder access.");msg="Moved "+srcName+" to "+dest.getName()+".";}catch(Exception ex){if(copied!=null)copied.delete();msg="Move failed ("+ex.getClass().getSimpleName()+"): "+ex.getMessage();}final DocumentFile saved=copied;final String result=msg;runOnUiThread(()->{working=false;if(result.startsWith("Moved ")){undoDestination=saved;undoOriginalName=srcName;photos.remove(position);showCurrent();}else{image.animate().translationX(0).translationY(0).setDuration(130).start();}status.setText(result);});}).start();}
    private void undoMove(){if(undoDestination==null||root==null||working){status.setText("There is no recent move to undo.");return;}working=true;DocumentFile moved=undoDestination;String name=undoOriginalName;new Thread(()->{String msg;try{String mime=getContentResolver().getType(moved.getUri());DocumentFile restored=root.createFile(mime==null?"application/octet-stream":mime,uniqueName(root,name));try(InputStream in=getContentResolver().openInputStream(moved.getUri());OutputStream out=getContentResolver().openOutputStream(restored.getUri(),"w")){if(in==null||out==null)throw new Exception("Could not open file.");byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}if(!moved.delete())throw new Exception("Restored, but could not remove sorted copy.");msg="Move undone.";undoDestination=null;}catch(Exception ex){msg="Undo failed: "+ex.getMessage();}String result=msg;runOnUiThread(()->{working=false;if(result.equals("Move undone."))scan();status.setText(result);});}).start();}
}
