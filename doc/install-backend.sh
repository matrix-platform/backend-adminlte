folder='vendor/matrix-platform/backend-adminlte'

cp -R ${folder}/www .

rm -rf www/adminlte www/js/ckeditor
mkdir -p www/adminlte
cp -R vendor/almasaeed2010/adminlte/{dist,plugins} www/adminlte
cp -R vendor/ckeditor/ckeditor www/js

touch www/css/backend-custom.css www/css/ckeditor.css

for path in $(cat ${folder}/doc/gitignore) ; do
    grep -qxF "$path" .gitignore || echo "$path" >> .gitignore
done
